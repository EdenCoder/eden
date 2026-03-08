// ============================================================================
// @edenup/core — Orchestrator (Codename: "Parcae")
// ============================================================================
// The CTO — designs orgs, hires agents, runs kickoff meetings,
// monitors health/budget, processes tool requests, then gets out of the way.

import { Daemon } from '../daemon.js'
import type { EdenConfig, AgentConfig } from '../types.js'
import type { MessagingAdapter } from '@edenup/messaging'

export class Orchestrator {
  private daemon: Daemon
  private edenConfig: EdenConfig

  constructor(config: EdenConfig, messaging: MessagingAdapter[]) {
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
        default: 'claude-sonnet-4-20250514',
        planning: 'claude-opus-4-20250115',
        cheap: 'claude-haiku-4-5-20251001',
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
        local: ['./skills'], // Orchestrator specific skills
        global: ['skills'],  // Global shared skills
      },
    }

    this.daemon = new Daemon(orchestratorAgentConfig, messaging, {
      onStateChange: async (_from, _to) => {
        // TODO: Post state change to #dashboard via primary adapter
      },
      onHeartbeat: async () => {
        // TODO: Check all agent health, budgets, process tool requests
      },
      onError: async (_error) => {
        // TODO: Log error, attempt self-recovery
      },
      onTask: async (_task) => {
        // TODO: Process orchestrator task (org design, agent creation, etc.)
        // Uses ToolLoopAgent from AI SDK under the hood
      },
    })
  }

  async boot(): Promise<void> {
    await this.daemon.boot()
    await this.daemon.run()
  }

  async stop(): Promise<void> {
    await this.daemon.stop()
  }

  // --- CTO Operations ---

  async designOrg(goal: string): Promise<void> {
    // TODO: Use planning model to decompose goal into agent roles
    // TODO: Post proposal to #control for human approval
    // TODO: Wait for approval
    // TODO: Bootstrap agents
    // TODO: Run kickoff meeting
  }

  async spawnAgent(config: AgentConfig): Promise<void> {
    // TODO: Scaffold from template, write config, create channels, boot daemon
  }

  async killAgent(agentName: string, reason: string): Promise<void> {
    // TODO: Stop daemon, archive channels, post to #control
  }

  async updateAgent(agentName: string, changes: Partial<AgentConfig>): Promise<void> {
    // TODO: Apply changes, restart if needed
  }
}
