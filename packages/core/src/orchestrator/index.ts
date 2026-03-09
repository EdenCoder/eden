// ============================================================================
// @edenup/core — Orchestrator (Codename: "Parcae")
// ============================================================================
// The CTO — designs orgs, hires agents, runs kickoff meetings,
// monitors health/budget, processes tool requests, then gets out of the way.

import { Daemon } from '../daemon.js'
import type { EdenConfig, AgentConfig } from '../types.js'
import type { MessagingAdapter, IncomingMessage } from '@edenup/messaging'
import type { WorkerAgent } from '../agent.js'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'
import { createManageAgentTools } from './tools/manage-agents.js'

export class Orchestrator {
  private daemon: Daemon
  private edenConfig: EdenConfig
  private agentTools: ReturnType<typeof createManageAgentTools> | null = null

  constructor(
    config: EdenConfig,
    messaging: MessagingAdapter[],
    private agents: Map<string, WorkerAgent>,
    private onAgentBooted: (name: string, agent: WorkerAgent) => void,
  ) {
    this.edenConfig = config

    const orchestratorAgentConfig: AgentConfig = {
      name: 'parcae',
      description: 'The orchestrator — designs organizations, manages agents, monitors health',
      personality: 'Strategic, decisive, speaks concisely, delegates effectively',
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
      tools: {
        builtin: ['filesystem', 'shell'],
        mcp: [],
      },
      skills: {
        local: ['./skills'],
        global: ['skills'],
      },
    }

    this.daemon = new Daemon(orchestratorAgentConfig, messaging, {
      onStateChange: async (_from, _to) => {},
      onHeartbeat: async () => {},
      onError: async (_error) => {},
      onTask: async (_task) => {},
    })
  }

  async boot(): Promise<void> {
    // Create agent management tools — these are live and share the agents map
    this.agentTools = createManageAgentTools(
      this.edenConfig,
      [...this.daemon.adapters],
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

    // Immediate feedback: eyes emoji
    await adapter.addReaction(msgHandle, '👀')

    const openrouter = createOpenRouter({
      apiKey: this.edenConfig.llm.openrouter.apiKey,
    })

    const modelName = this.daemon.config.router.default
    console.log(`[Orchestrator] Processing mention using model ${modelName}...`)

    // Switch to thinking emoji + typing
    await adapter.removeReaction(msgHandle, '👀')
    await adapter.addReaction(msgHandle, '🤔')
    await adapter.startTyping(channelHandle)

    // Build list of running agents for context
    const agentNames = Array.from(this.agents.keys())
    const agentList = agentNames.length > 0
      ? `Currently running agents: ${agentNames.join(', ')}`
      : 'No sub-agents are currently running.'

    try {
      const { text } = await generateText({
        model: openrouter(modelName),
        system: `You are ${this.daemon.config.name}, the CTO and orchestrator of an AI agent team called Eden.
Your personality: ${this.daemon.config.personality}

${agentList}

You have tools to create, list, update, and remove sub-agents. When the user asks you to add a team member, use the createAgent tool. When they ask who's on the team, use listAgents. When they want to change an agent, use updateAgent. When they want to remove one, use removeAgent.

Each agent you create will appear as a distinct persona in Discord that users can @mention to talk to directly.

Respond concisely. Do not over-explain.`,
        prompt: message.content,
        tools: this.agentTools!,
        maxSteps: 5,
      })

      // Done — remove thinking emoji
      await adapter.removeReaction(msgHandle, '🤔')

      if (text) {
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
