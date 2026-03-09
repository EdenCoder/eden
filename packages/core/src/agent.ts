// ============================================================================
// @edenup/core — Worker Agent
// ============================================================================

import { Daemon } from './daemon.js'
import type { EdenConfig, AgentConfig } from './types.js'
import type { MessagingAdapter, IncomingMessage } from '@edenup/messaging'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'

export class WorkerAgent {
  private daemon: Daemon
  private edenConfig: EdenConfig

  constructor(
    config: EdenConfig,
    agentConfig: AgentConfig,
    messaging: MessagingAdapter[]
  ) {
    this.edenConfig = config

    this.daemon = new Daemon(agentConfig, messaging, {
      onStateChange: async (_from, _to) => {
        // TODO: Post state transition
      },
      onHeartbeat: async () => {
        // TODO: Heartbeat
      },
      onError: async (_error) => {
        // TODO: Log error
      },
      onTask: async (_task) => {
        // TODO: Process agent tasks
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

  async handleMention(adapterName: string, message: IncomingMessage): Promise<void> {
    const adapter = this.daemon.adapters.find(a => a.name === adapterName)
    if (!adapter) return

    const agentName = this.daemon.config.name
    const msgHandle = { id: message.id, channelId: message.channelId, platform: adapterName }
    const channelHandle = { id: message.channelId, name: 'unknown', platform: adapterName }

    // Immediate feedback: eyes emoji
    await adapter.addReaction(msgHandle, '👀')

    const openrouter = createOpenRouter({
      apiKey: this.edenConfig.llm.openrouter.apiKey,
    })

    const modelName = this.daemon.config.router.default
    console.log(`[Agent:${agentName}] Processing mention using model ${modelName}...`)

    // Switch to thinking + typing
    await adapter.removeReaction(msgHandle, '👀')
    await adapter.addReaction(msgHandle, '🤔')
    await adapter.startTyping(channelHandle)

    try {
      const { text } = await generateText({
        model: openrouter(modelName),
        system: `You are ${agentName}.
Your personality: ${this.daemon.config.personality}
Respond concisely to the user. Do not prefix your response with your name.`,
        prompt: message.content,
      })

      // Done — remove thinking emoji
      await adapter.removeReaction(msgHandle, '🤔')

      await adapter.sendMessage(channelHandle, { 
        text,
        author: {
          name: agentName,
        }
      })
    } catch (error) {
      console.error(`[Agent:${agentName}] Error generating response:`, error)
      await adapter.removeReaction(msgHandle, '🤔')
      await adapter.addReaction(msgHandle, '❌')
    }
  }
}
