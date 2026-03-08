// ============================================================================
// @edenup/core — Multi-Agent Orchestration Framework
// ============================================================================
//
// Usage:
//
//   import { createEden } from '@edenup/core'
//   import { DiscordAdapter } from '@edenup/discord'
//
//   const eden = createEden({
//     config: myConfig,
//     messaging: [
//       new DiscordAdapter({ botToken: '...', guildId: '...' }),
//     ],
//   })
//
//   await eden.start()

import type { EdenConfig } from './types.js'
import type { MessagingAdapter } from '@edenup/messaging'
import { Database } from './db.js'
import { HealthMonitor } from './health.js'
import { BudgetTracker } from './budget.js'
import { MeetingManager } from './meeting.js'
import { MemoryManager } from './memory.js'
import { ToolManager } from './tools.js'
import { ApprovalManager } from './approval.js'
import { ContextBuilder } from './context.js'
import { Logger } from './logger.js'
import { discoverSkills, buildSkillsPrompt } from './skills.js'

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
  private health: HealthMonitor
  private budget: BudgetTracker
  private meetings: MeetingManager
  private memory: MemoryManager
  private tools: ToolManager
  private approval: ApprovalManager
  private context: ContextBuilder
  private logger: Logger

  constructor(options: EdenOptions) {
    if (options.messaging.length === 0) {
      throw new Error('At least one MessagingAdapter is required')
    }

    this.config = options.config
    this.adapters = options.messaging
    this.primary = this.adapters[0]

    this.db = new Database({ path: `${options.config.paths.data}/eden.lance` })
    this.health = new HealthMonitor()
    this.budget = new BudgetTracker()
    this.meetings = new MeetingManager()
    this.memory = new MemoryManager()
    this.tools = new ToolManager()
    this.approval = new ApprovalManager()
    this.context = new ContextBuilder()
    this.logger = new Logger('eden')
  }

  async start(): Promise<void> {
    this.logger.info('Eden starting...')
    this.logger.info(
      `Messaging adapters: ${this.adapters.map((a) => a.name).join(', ')}`,
    )

    // 1. Connect to database
    await this.db.connect()
    this.logger.info('Database connected')

    // 2. Connect all messaging adapters
    await Promise.all(this.adapters.map(async (adapter) => {
      await adapter.connect()
      this.logger.info(`Messaging adapter connected: ${adapter.name}`)
    }))

    // 3. Discover skills (progressive disclosure — metadata only)
    const skills = await discoverSkills([
      this.config.paths.skills, // Global shared skills
      // Orchestrator skills are discovered separately
    ])
    this.logger.info(`Discovered ${skills.length} global skills: ${skills.map(s => s.name).join(', ')}`)

    // 4. Set up server layout on each adapter
    await Promise.all(this.adapters.map((adapter) => this.setupServerLayout(adapter)))
    this.logger.info('Server layouts configured')

    // 5. Boot orchestrator
    await this.bootOrchestrator()
    this.logger.info('Orchestrator online')

    // 6. Boot existing agents
    await this.bootExistingAgents()
    this.logger.info('All agents online')

    // 7. Post control panel on each adapter
    await Promise.all(this.adapters.map((adapter) => this.postControlPanel(adapter)))
    this.logger.info('Control panels posted')

    this.logger.info('Eden is running. Waiting for instructions.')
  }

  async stop(): Promise<void> {
    this.logger.info('Eden shutting down...')

    // TODO: Stop all agents
    // TODO: Stop orchestrator
    // TODO: Post shutdown summary on all adapters

    await Promise.all(this.adapters.map(async (adapter) => {
      await adapter.disconnect()
      this.logger.info(`Messaging adapter disconnected: ${adapter.name}`)
    }))

    await this.db.disconnect()
    this.logger.info('Eden stopped.')
  }

  getAdapter(name: string): MessagingAdapter | undefined {
    return this.adapters.find((a) => a.name === name)
  }

  getPrimaryAdapter(): MessagingAdapter {
    return this.primary
  }

  getAdapters(): readonly MessagingAdapter[] {
    return this.adapters
  }

  private async setupServerLayout(_adapter: MessagingAdapter): Promise<void> {
    // TODO: Create/verify all categories and channels on this adapter
    // TODO: Set permissions based on access config
    // TODO: Create workspace channels
  }

  private async bootOrchestrator(): Promise<void> {
    // TODO: Boot the orchestrator daemon with ToolLoopAgent from AI SDK
    // TODO: Discover orchestrator skills, register loadSkill tool
  }

  private async bootExistingAgents(): Promise<void> {
    // TODO: Scan agents/ directory for existing agent configs
    // TODO: Boot each agent as a ToolLoopAgent with loadSkill, passing adapters
  }

  private async postControlPanel(_adapter: MessagingAdapter): Promise<void> {
    // TODO: Post/update the control panel pinned message
  }
}

// --- Re-exports ---
export * from './types.js'
export { Daemon } from './daemon.js'
export { ContextBuilder } from './context.js'
export type { ContextAdapter, TaskDescription } from './context.js'
export { BudgetTracker } from './budget.js'
export { MeetingManager } from './meeting.js'
export { MemoryManager } from './memory.js'
export { ToolManager } from './tools.js'
export { ApprovalManager } from './approval.js'
export { Logger } from './logger.js'
export { HealthMonitor } from './health.js'
export { Database } from './db.js'
export { getUserRole, hasPermission, isKnownUser } from './access.js'
export { routeModel } from './router.js'
export { discoverSkills, buildSkillsPrompt, loadSkillTool } from './skills.js'
