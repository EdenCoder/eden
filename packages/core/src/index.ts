// ============================================================================
// @edenup/core — Multi-Agent Orchestration Framework
// ============================================================================

import type { EdenConfig } from './types.js'
import type { MessagingAdapter } from '@edenup/messaging'
import { Database } from './db.js'
import { Logger } from './logger.js'
import { discoverSkills, buildSkillsPrompt, loadSkillTool } from './skills.js'
import type { SkillMetadata } from './skills.js'
import { Orchestrator } from './orchestrator/index.js'
import { WorkerAgent } from './agent.js'
import { readdir, cp, mkdir, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

export interface EdenOptions {
  config: EdenConfig
  messaging: MessagingAdapter[]
}

export function createEden(options: EdenOptions): Eden {
  return new Eden(options)
}

export class Eden {
  private config: EdenConfig
  private adapters: MessagingAdapter[]
  private primary: MessagingAdapter
  private db: Database
  private logger: Logger
  private orchestrator: Orchestrator
  private agents: Map<string, WorkerAgent> = new Map()
  private skills: SkillMetadata[] = []

  constructor(options: EdenOptions) {
    if (options.messaging.length === 0) {
      throw new Error('At least one MessagingAdapter is required')
    }

    this.config = options.config
    this.adapters = options.messaging
    this.primary = this.adapters[0]
    this.db = new Database({ path: `${options.config.paths.data}/lance` })
    this.logger = new Logger('eden')
    this.orchestrator = new Orchestrator(
      this.config,
      this.adapters,
      this.db,
      this.agents,
    )
  }

  private wireAgentMentions(name: string, agent: WorkerAgent): void {
    for (const adapter of this.adapters) {
      adapter.onMention(name, (message) => {
        this.logger.info(`Agent ${name} received mention in ${adapter.name}`)
        agent.handleMention(adapter.name, message)
      })
    }
  }

  async start(): Promise<void> {
    this.logger.info('Eden starting...')
    this.logger.info(`Messaging adapters: ${this.adapters.map(a => a.name).join(', ')}`)

    // 1. Connect database
    await this.db.connect()
    this.logger.info('Database connected')

    // 2. Connect messaging adapters
    await Promise.all(this.adapters.map(async (adapter) => {
      await adapter.connect()
      this.logger.info(`Messaging adapter connected: ${adapter.name}`)
    }))

    // 3. Provision default skills into .agents/skills/ if missing
    await this.provisionDefaultSkills()

    // 4. Discover skills from .agents/skills/
    const skillsDir = resolve(process.cwd(), '.agents/skills')
    this.skills = await discoverSkills([skillsDir])
    this.logger.info(`Discovered ${this.skills.length} skills: ${this.skills.map(s => s.name).join(', ')}`)

    // 5. Set up server layout
    await Promise.all(this.adapters.map(a => this.setupServerLayout(a)))
    this.logger.info('Server layouts configured')

    // 6. Boot orchestrator with skills
    await this.orchestrator.boot(this.skills)
    for (const adapter of this.adapters) {
      adapter.onMention('parcae', (message) => {
        this.logger.info(`Orchestrator received mention in ${adapter.name}`)
        this.orchestrator.handleMention(adapter.name, message)
      }, true)
    }
    this.logger.info('Orchestrator online')

    // 7. Boot existing agents
    await this.bootExistingAgents()
    this.logger.info('All agents online')

    // 8. Post control panel
    await Promise.all(this.adapters.map(a => this.postControlPanel(a)))
    this.logger.info('Control panels posted')

    this.logger.info('Eden is running. Waiting for instructions.')
  }

  async stop(): Promise<void> {
    this.logger.info('Eden shutting down...')
    await Promise.all(this.adapters.map(async (adapter) => {
      await adapter.disconnect()
      this.logger.info(`Messaging adapter disconnected: ${adapter.name}`)
    }))
    await this.db.disconnect()
    this.logger.info('Eden stopped.')
  }

  /**
   * Copy default skills from @edenup/skills package into .agents/skills/
   * if they don't already exist. Users can override by placing their own
   * version in .agents/skills/.
   */
  private async provisionDefaultSkills(): Promise<void> {
    const targetDir = resolve(process.cwd(), '.agents/skills')
    await mkdir(targetDir, { recursive: true })

    // Find the @edenup/skills package — it's a sibling package in the monorepo
    // or installed in node_modules
    const possiblePaths = [
      resolve(process.cwd(), 'submodules/eden/packages/skills'),  // Dev: monorepo
      resolve(process.cwd(), 'node_modules/@edenup/skills'),       // Published
    ]

    let sourcePath: string | null = null
    for (const p of possiblePaths) {
      try {
        await access(p)
        sourcePath = p
        break
      } catch {}
    }

    if (!sourcePath) {
      this.logger.warn('Could not find @edenup/skills package, skipping default skill provisioning')
      return
    }

    // Copy each skill dir that doesn't already exist in target
    let entries
    try {
      entries = await readdir(sourcePath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules') continue

      const target = join(targetDir, entry.name)
      try {
        await access(target)
        // Already exists — user may have customized it, don't overwrite
      } catch {
        // Doesn't exist — copy from package
        await cp(join(sourcePath, entry.name), target, { recursive: true })
        this.logger.info(`Provisioned default skill: ${entry.name}`)
      }
    }
  }

  private async setupServerLayout(_adapter: MessagingAdapter): Promise<void> {}

  private async bootExistingAgents(): Promise<void> {
    const agentsPath = resolve(process.cwd(), this.config.paths.agents)

    let entries
    try {
      entries = await readdir(agentsPath, { withFileTypes: true })
    } catch {
      this.logger.warn(`Could not read agents directory at ${agentsPath}. Skipping subagents.`)
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const configPath = join(agentsPath, entry.name, 'agent.config.ts')

      try {
        const mod = await import(configPath)
        const agentConfig = mod.default
        if (!agentConfig?.name) throw new Error('Config missing or missing name')

        const agent = new WorkerAgent(this.config, agentConfig, this.adapters, this.db, this.skills)
        await agent.boot()

        this.agents.set(agentConfig.name, agent)
        this.wireAgentMentions(agentConfig.name, agent)
        await this.db.registerAgent(agentConfig.name)
        this.logger.success(`Booted local agent: ${agentConfig.name}`)
      } catch (err: any) {
        this.logger.error(`Failed to boot agent in ${entry.name}: ${err.message}`)
      }
    }
  }

  private async postControlPanel(_adapter: MessagingAdapter): Promise<void> {}
}

// --- Re-exports ---
export * from './types.js'
export { WorkerAgent } from './agent.js'
export { Daemon } from './daemon.js'
export { Logger } from './logger.js'
export { Database } from './db.js'
export { discoverSkills, buildSkillsPrompt, loadSkillTool } from './skills.js'
export type { SkillMetadata } from './skills.js'
