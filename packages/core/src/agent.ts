// ============================================================================
// @edenup/core — Worker Agent
// ============================================================================

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Daemon } from './daemon.js'
import type { EdenConfig, AgentConfig } from './types.js'
import type { Database } from './db.js'
import type { MessagingAdapter, IncomingMessage } from '@edenup/messaging'
import type { SkillMetadata } from './skills.js'
import { discoverSkills, buildSkillsPrompt, loadSkillTool } from './skills.js'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ToolLoopAgent, tool } from 'ai'
import { z } from 'zod'

const exec = promisify(execFile)

export class WorkerAgent {
  private daemon: Daemon
  private edenConfig: EdenConfig
  private db: Database
  private agentMd: string = ''
  private globalSkills: SkillMetadata[]
  private allSkills: SkillMetadata[] = []

  constructor(
    config: EdenConfig,
    agentConfig: AgentConfig,
    messaging: MessagingAdapter[],
    db: Database,
    globalSkills: SkillMetadata[] = [],
  ) {
    this.edenConfig = config
    this.db = db
    this.globalSkills = globalSkills

    this.daemon = new Daemon(agentConfig, messaging, {
      onStateChange: async () => {},
      onHeartbeat: async () => {},
      onError: async () => {},
      onTask: async () => {},
    })
  }

  async boot(): Promise<void> {
    const agentName = this.daemon.config.name
    const agentDir = join(resolve(process.cwd(), this.edenConfig.paths.agents), agentName)

    // Load AGENT.md persona
    try {
      this.agentMd = await readFile(join(agentDir, 'AGENT.md'), 'utf-8')
    } catch {
      this.agentMd = `You are ${agentName}. ${this.daemon.config.description}\n\n${this.daemon.config.personality}`
    }

    // Discover agent-specific skills from agents/<name>/.agents/skills/
    const agentSkillsDir = join(agentDir, '.agents', 'skills')
    const agentSkills = await discoverSkills([agentSkillsDir])

    // Merge: global skills as base, agent-specific override by name
    const skillMap = new Map<string, SkillMetadata>()
    for (const s of this.globalSkills) skillMap.set(s.name, s)
    for (const s of agentSkills) skillMap.set(s.name, s)
    this.allSkills = Array.from(skillMap.values())

    // Ensure eden-todos and eden-meetings are always present (core agent skills)
    const requiredSkills = ['eden-todos', 'eden-meetings']
    const missing = requiredSkills.filter(name => !skillMap.has(name))
    if (missing.length > 0) {
      console.warn(`[Agent:${agentName}] Missing required skills: ${missing.join(', ')} — check .agents/skills/`)
    }

    if (agentSkills.length > 0) {
      console.log(`[Agent:${agentName}] Agent-specific skills: ${agentSkills.map(s => s.name).join(', ')}`)
    }

    await this.daemon.boot()
    await this.daemon.run()
  }

  async stop(): Promise<void> {
    await this.daemon.stop()
  }

  async handleMention(adapterName: string, message: IncomingMessage): Promise<void> {
    const adapter = this.daemon.adapters.find(a => a.name === adapterName)
    if (!adapter) return

    const agentName = this.daemon.config.name
    const msgHandle = { id: message.id, channelId: message.channelId, platform: adapterName }
    const channelHandle = { id: message.channelId, name: 'unknown', platform: adapterName }

    await adapter.addReaction(msgHandle, '👀')

    const openrouter = createOpenRouter({ apiKey: this.edenConfig.llm.openrouter.apiKey })
    const modelName = this.daemon.config.router.default

    console.log(`[Agent:${agentName}] Processing mention using ${modelName}...`)

    await adapter.addReaction(msgHandle, '🤔')
    await adapter.removeReaction(msgHandle, '👀')
    await adapter.startTyping(channelHandle)

    // Conversation history
    const channelKey = `${adapterName}:${message.channelId}`
    await this.db.addMessage(channelKey, agentName, 'user', message.content)
    let history = await this.db.getHistory(channelKey, agentName, 50)
    if (history.length === 0) {
      history = [{ role: 'user' as const, content: message.content }]
    }

    // System prompt = AGENT.md + available skills
    const skillsPrompt = buildSkillsPrompt(this.allSkills)
    const system = `${this.agentMd}\n\n${skillsPrompt}`.trim()

    // AI SDK tools: loadSkill + bash + readFile
    const tools = {
      loadSkill: loadSkillTool(this.allSkills),
      bash: tool({
        description: 'Execute a bash command in the project root. Use for running skill scripts, opencode, or any shell command.',
        parameters: z.object({
          command: z.string().describe('The bash command to execute'),
        }),
        execute: async (input: { command: string }) => {
          console.log(`[Agent:${agentName}:bash] ${input.command}`)
          try {
            const { stdout, stderr } = await exec('bash', ['-c', input.command], {
              cwd: process.cwd(),
              timeout: 120_000,
              maxBuffer: 1024 * 1024 * 10,
            })
            const output = stdout.trim() || stderr.trim() || '(no output)'
            return output
          } catch (error: any) {
            return `Error: ${error.stderr || error.message}`
          }
        },
      }),
      readFile: tool({
        description: 'Read a file from the filesystem.',
        parameters: z.object({
          path: z.string().describe('Path to the file, relative to project root'),
        }),
        execute: async (input: { path: string }) => {
          try {
            const content = await readFile(join(process.cwd(), input.path), 'utf-8')
            return content
          } catch (error: any) {
            return `Error reading ${input.path}: ${error.message}`
          }
        },
      }),
    }

    try {
      const agent = new ToolLoopAgent({
        model: openrouter(modelName),
        tools,
        instructions: system,
      })

      const result = await agent.generate({
        messages: history.map(m => ({ role: m.role, content: m.content })),
      })

      await adapter.removeReaction(msgHandle, '🤔')

      const text = result.text
      if (text) {
        await this.db.addMessage(channelKey, agentName, 'assistant', text)
        await adapter.sendMessage(channelHandle, {
          text,
          author: { name: agentName },
        })
      }
    } catch (error) {
      console.error(`[Agent:${agentName}] Error:`, error)
      await adapter.removeReaction(msgHandle, '🤔')
      await adapter.addReaction(msgHandle, '❌')
    }
  }
}
