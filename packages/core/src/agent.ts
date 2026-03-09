// ============================================================================
// @edenup/core — Worker Agent
// ============================================================================

import { Daemon } from './daemon.js'
import type { EdenConfig, AgentConfig } from './types.js'
import type { MessagingAdapter, IncomingMessage } from '@edenup/messaging'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export class WorkerAgent {
  private daemon: Daemon
  private edenConfig: EdenConfig
  private history: Map<string, ConversationMessage[]> = new Map()

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

    // Switch to thinking — add thinking FIRST, then remove eyes (no flicker)
    await adapter.addReaction(msgHandle, '🤔')
    await adapter.removeReaction(msgHandle, '👀')
    await adapter.startTyping(channelHandle)

    // Get or create conversation history for this channel
    const channelKey = `${adapterName}:${message.channelId}`
    if (!this.history.has(channelKey)) {
      this.history.set(channelKey, [])
    }
    const history = this.history.get(channelKey)!

    // Add the user's message to history
    history.push({ role: 'user', content: message.content })

    // Keep last 50 messages
    if (history.length > 50) {
      history.splice(0, history.length - 50)
    }

    try {
      const { text } = await generateText({
        model: openrouter(modelName),
        system: `You are ${agentName}. ${this.daemon.config.description}
Your personality: ${this.daemon.config.personality}
Respond concisely to the user. Do not prefix your response with your name.`,
        messages: history.map(m => ({ role: m.role, content: m.content })),
      })

      // Done — remove thinking emoji
      await adapter.removeReaction(msgHandle, '🤔')

      if (text) {
        // Save assistant response to history
        history.push({ role: 'assistant', content: text })

        await adapter.sendMessage(channelHandle, { 
          text,
          author: {
            name: agentName,
          }
        })
      }
    } catch (error) {
      console.error(`[Agent:${agentName}] Error generating response:`, error)
      await adapter.removeReaction(msgHandle, '🤔')
      await adapter.addReaction(msgHandle, '❌')
    }
  }
}
