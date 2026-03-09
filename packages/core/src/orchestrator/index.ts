// ============================================================================
// @edenup/core — Orchestrator
// ============================================================================

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Daemon } from '../daemon.js'
import type { EdenConfig, AgentConfig } from '../types.js'
import type { MessagingAdapter, IncomingMessage } from '@edenup/messaging'
import type { WorkerAgent } from '../agent.js'
import type { Database } from '../db.js'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ToolLoopAgent } from 'ai'
import { createManageAgentTools } from './tools/manage-agents.js'

export class Orchestrator {
  private daemon: Daemon
  private edenConfig: EdenConfig
  private db: Database
  private agentTools: ReturnType<typeof createManageAgentTools> | null = null
  private agentMd: string = ''

  constructor(
    config: EdenConfig,
    messaging: MessagingAdapter[],
    db: Database,
    private agents: Map<string, WorkerAgent>,
    private onAgentBooted: (name: string, agent: WorkerAgent) => void,
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
        routes: {
          'org-design': 'planning',
          'health-check': 'cheap',
          'status-update': 'cheap',
          'tool-research': 'default',
        },
      },
      budget: {
        maxPerDay: 10.0,
        maxPerTask: 2.0,
        maxLifetime: 200.0,
        warnAt: 0.8,
        onExhausted: 'escalate',
      },
      daemon: {
        mode: 'event',
        heartbeatIntervalMs: 15_000,
        maxConsecutiveErrors: 3,
        restartDelayMs: 5_000,
      },
      approval: {
        alwaysApprove: [],
        approveAbove: { costUsd: 5.0 },
        timeoutMs: 60 * 60 * 1000,
        onTimeout: 'escalate',
      },
      tools: { builtin: ['filesystem', 'shell'], mcp: [] },
      skills: { local: ['./skills'], global: ['skills'] },
    }

    this.daemon = new Daemon(orchestratorAgentConfig, messaging, {
      onStateChange: async () => {},
      onHeartbeat: async () => {},
      onError: async () => {},
      onTask: async () => {},
    })
  }

  async boot(): Promise<void> {
    // Load /AGENT.md from project root
    try {
      this.agentMd = await readFile(join(process.cwd(), 'AGENT.md'), 'utf-8')
    } catch {
      console.warn('[Orchestrator] No AGENT.md found in project root, using defaults')
      this.agentMd = 'You are the orchestrator of an AI agent team. You manage the team and help the user get things done. Respond concisely.'
    }

    this.agentTools = createManageAgentTools(
      this.edenConfig,
      [...this.daemon.adapters],
      this.db,
      this.agents,
      this.onAgentBooted,
    )

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

    const openrouter = createOpenRouter({
      apiKey: this.edenConfig.llm.openrouter.apiKey,
    })

    const modelName = this.daemon.config.router.default
    console.log(`[Orchestrator] Processing mention using model ${modelName}...`)

    await adapter.addReaction(msgHandle, '🤔')
    await adapter.removeReaction(msgHandle, '👀')
    await adapter.startTyping(channelHandle)

    // Build dynamic context
    const agentNames = Array.from(this.agents.keys())
    const agentList = agentNames.length > 0
      ? `Currently running agents: ${agentNames.join(', ')}`
      : 'No sub-agents are currently running.'

    // Conversation history from DB
    const channelKey = `${adapterName}:${message.channelId}`
    await this.db.addMessage(channelKey, 'orchestrator', 'user', message.content)
    let history = await this.db.getHistory(channelKey, 'orchestrator', 50)
    if (history.length === 0) {
      history = [{ role: 'user' as const, content: message.content }]
    }

    const system = `${this.agentMd}\n\n${agentList}`.trim()

    try {
      // Use ToolLoopAgent — handles tool call → result → continue loop properly
      const agent = new ToolLoopAgent({
        model: openrouter(modelName),
        tools: this.agentTools!,
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
      console.error('[Orchestrator] Error generating response:', error)
      await adapter.removeReaction(msgHandle, '🤔')
      await adapter.addReaction(msgHandle, '❌')
      await adapter.sendMessage(channelHandle, { text: `Error: ${error}` })
    }
  }
}
