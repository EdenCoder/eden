// ============================================================================
// Agent Config Template
// ============================================================================
// The orchestrator copies this and customizes it for each new agent.

import type { AgentConfig } from '@edenup/core'

export default {
  // Identity — filled in by orchestrator
  name: '{{AGENT_NAME}}',
  description: '{{AGENT_DESCRIPTION}}',
  personality: '{{AGENT_PERSONALITY}}',

  // Messaging (adapter-agnostic)
  messaging: {
    channelName: '{{AGENT_NAME}}',
    verboseChannelName: 'verbose-{{AGENT_NAME}}',
    threadPerTask: true,
    updateMode: 'edit',
    statusEmoji: '🤖',
    throttleMs: 3000,
    verboseCollapsible: true,
  },

  // Model routing
  router: {
    default: 'anthropic/claude-sonnet-4.6',
    planning: 'anthropic/claude-opus-4.6',
    cheap: 'anthropic/claude-haiku-4.5',
    routes: {},
  },

  // Budget
  budget: {
    maxPerDay: 5.0,
    maxPerTask: 1.0,
    maxLifetime: 100.0,
    warnAt: 0.8,
    onExhausted: 'pause',
  },

  // Daemon behavior
  daemon: {
    mode: 'event',
    heartbeatIntervalMs: 30_000,
    maxConsecutiveErrors: 5,
    restartDelayMs: 10_000,
  },

  // Human-in-the-loop
  approval: {
    alwaysApprove: ['git-push', 'deploy', 'delete-file'],
    approveAbove: { costUsd: 0.5 },
    timeoutMs: 30 * 60 * 1000,
    onTimeout: 'skip',
  },

  // Tools — orchestrator fills in based on agent's role
  tools: {
    builtin: ['filesystem'],
    mcp: [],
  },

  // Skills (Agent Skills spec — SKILL.md folders)
  skills: {
    local: ['./skills'],            // Agent-specific skills directory
    global: ['skills'],             // Shared skills (project root /skills)
  },

  // Context
  context: {
    maxTokens: 128_000,
    compactionThreshold: 0.8,
    adapters: {
      memory: { enabled: true, maxFragments: 10, maxTokens: 4_000 },
      summary: { enabled: true, maxTokens: 2_000 },
      meeting: { enabled: true, maxTokens: 2_000, lookbackDays: 7 },
      compaction: { enabled: true, model: 'cheap' },
    },
  },
} satisfies AgentConfig
