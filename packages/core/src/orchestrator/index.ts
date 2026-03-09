// ============================================================================
// @edenup/core — Orchestrator
// ============================================================================

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Daemon } from '../daemon.js'
import type { EdenConfig, AgentConfig } from '../types.js'
import type { MessagingAdapter, IncomingMessage } from '@edenup/messaging'
import type { WorkerAgent } from '../agent.js'
import type { Database } from '../db.js'
import type { SkillMetadata } from '../skills.js'
import { buildSkillsPrompt, loadSkillTool } from '../skills.js'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ToolLoopAgent, tool } from 'ai'
import { z } from 'zod'

const exec = promisify(execFile)

export class Orchestrator {
  private daemon: Daemon
  private edenConfig: EdenConfig
  private db: Database
  private agentMd: string = ''
  private skills: SkillMetadata[] = []

  constructor(
    config: EdenConfig,
    messaging: MessagingAdapter[],
    db: Database,
    private agents: Map<string, WorkerAgent>,
  ) {
    this.edenConfig = config
    this.db = db

    const orchestratorAgentConfig: AgentConfig = {
      name: 'parcae',
      description: 'The orchestrator',
      personality: '',
      messaging: {
        channelName: 'dashboard',
        verboseChannelName: 'verbose-parcae',
        threadPerTask: false,
        updateMode: 'edit',
        statusEmoji: '🧠',
        throttleMs: 3000,
        verboseCollapsible: true,
      },
      router: {
        default: 'anthropic/claude-sonnet-4.6',
        planning: 'anthropic/claude-opus-4.6',
        cheap: 'anthropic/claude-haiku-4.5',
        routes: {},
      },
      budget: {
        maxPerDay: 10.0, maxPerTask: 2.0, maxLifetime: 200.0,
        warnAt: 0.8, onExhausted: 'escalate',
      },
      daemon: {
        mode: 'event', heartbeatIntervalMs: 15_000,
        maxConsecutiveErrors: 3, restartDelayMs: 5_000,
      },
      approval: {
        alwaysApprove: [], approveAbove: { costUsd: 5.0 },
        timeoutMs: 60 * 60 * 1000, onTimeout: 'escalate',
      },
      tools: { builtin: [], mcp: [] },
      skills: { local: [], global: [] },
    }

    this.daemon = new Daemon(orchestratorAgentConfig, messaging, {
      onStateChange: async () => {},
      onHeartbeat: async () => {},
      onError: async () => {},
      onTask: async () => {},
    })
  }

  async boot(skills: SkillMetadata[]): Promise<void> {
    this.skills = skills

    // Load /AGENT.md from project root
    try {
      this.agentMd = await readFile(join(process.cwd(), 'AGENT.md'), 'utf-8')
    } catch {
      this.agentMd = 'You are the orchestrator of an AI agent team. You manage the team and help the user get things done. Respond concisely.'
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

    const msgHandle = { id: message.id, channelId: message.channelId, platform: adapterName }
    const channelHandle = { id: message.channelId, name: 'unknown', platform: adapterName }

    await adapter.addReaction(msgHandle, '👀')

    const openrouter = createOpenRouter({ apiKey: this.edenConfig.llm.openrouter.apiKey })
    const modelName = this.daemon.config.router.default

    console.log(`[Orchestrator] Processing mention using ${modelName}...`)

    await adapter.addReaction(msgHandle, '🤔')
    await adapter.removeReaction(msgHandle, '👀')
    await adapter.startTyping(channelHandle)

    // Build dynamic context
    const agentNames = Array.from(this.agents.keys())
    const agentList = agentNames.length > 0
      ? `Currently running agents: ${agentNames.join(', ')}`
      : 'No sub-agents are currently running.'

    // Conversation history
    const channelKey = `${adapterName}:${message.channelId}`
    await this.db.addMessage(channelKey, 'orchestrator', 'user', message.content)
    let history = await this.db.getHistory(channelKey, 'orchestrator', 50)
    if (history.length === 0) {
      history = [{ role: 'user' as const, content: message.content }]
    }

    // System prompt = AGENT.md + agent list + available skills
    const skillsPrompt = buildSkillsPrompt(this.skills)
    const system = `${this.agentMd}\n\n${agentList}\n\n${skillsPrompt}`.trim()

    // AI SDK tools: loadSkill + bash + readFile
    const tools = {
      loadSkill: loadSkillTool(this.skills),
      bash: tool({
        description: 'Execute a bash command in the project root. Use for running skill scripts, opencode, or any shell command.',
        parameters: z.object({
          command: z.string().describe('The bash command to execute'),
        }),
        execute: async ({ command }) => {
          console.log(`[Orchestrator:bash] ${command}`)
          try {
            const { stdout, stderr } = await exec('bash', ['-c', command], {
              cwd: process.cwd(),
              timeout: 120_000,
              maxBuffer: 1024 * 1024 * 10,
            })
            const output = stdout.trim() || stderr.trim() || '(no output)'
            console.log(`[Orchestrator:bash] Done: ${output.slice(0, 150)}`)
            return output
          } catch (error: any) {
            const msg = error.stderr || error.message || String(error)
            console.error(`[Orchestrator:bash] Error: ${msg.slice(0, 200)}`)
            return `Error: ${msg}`
          }
        },
      }),
      readFile: tool({
        description: 'Read a file from the filesystem.',
        parameters: z.object({
          path: z.string().describe('Path to the file, relative to project root'),
        }),
        execute: async ({ path }) => {
          try {
            const content = await readFile(join(process.cwd(), path), 'utf-8')
            return content
          } catch (error: any) {
            return `Error reading ${path}: ${error.message}`
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
        await this.db.addMessage(channelKey, 'orchestrator', 'assistant', text)
        await adapter.sendMessage(channelHandle, { text })
      }
    } catch (error) {
      console.error('[Orchestrator] Error:', error)
      await adapter.removeReaction(msgHandle, '🤔')
      await adapter.addReaction(msgHandle, '❌')
      await adapter.sendMessage(channelHandle, { text: `Error: ${error}` })
    }
  }
}
