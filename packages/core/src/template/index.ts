// ============================================================================
// Agent Entrypoint Template
// ============================================================================
// Each agent runs this as its daemon. The orchestrator copies and customizes.

import { Daemon } from '@edenup/core'
import type { MessagingAdapter } from '@edenup/messaging'
import config from './agent.config.js'

export async function startAgent(messaging: MessagingAdapter[]): Promise<Daemon> {
  const daemon = new Daemon(config, messaging, {
    onStateChange: async (_from, _to) => {
      // TODO: Post state transition to agent's main channel
      // TODO: Log to verbose channel
    },
    onHeartbeat: async () => {
      // TODO: Report heartbeat to orchestrator
      // TODO: Check inbox for queued messages
    },
    onError: async (_error) => {
      // TODO: Log error, increment consecutive error count
      // TODO: If over threshold, transition to error state
    },
    onTask: async (_task) => {
      // TODO: Build context via ContextBuilder
      // TODO: Discover local skills + global skills
      // TODO: Run task with AI SDK ToolLoopAgent (passing loadSkill tool)
      // TODO: Extract and store memories on completion
    },
  })

  await daemon.boot()
  await daemon.run()

  return daemon
}
