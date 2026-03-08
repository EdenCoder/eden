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

    const openrouter = createOpenRouter({
      apiKey: this.edenConfig.llm.openrouter.apiKey,
    })

    const modelName = this.daemon.config.router.default
    console.log(`[Agent:${this.daemon.config.name}] Processing mention using model ${modelName}...`)

    try {
      const { text } = await generateText({
        model: openrouter(modelName),
        system: `You are ${this.daemon.config.name}.
Your personality: ${this.daemon.config.personality}
Respond concisely to the user. Do not prefix your response with your name.`,
        prompt: message.content,
      })

      await adapter.sendMessage(
        { id: message.channelId, name: 'unknown', platform: adapterName },
        { 
          text,
          author: {
            name: this.daemon.config.name,
            // We can add custom avatarURLs for agents in the config later!
          }
        }
      )
    } catch (error) {
      console.error(`[Agent:${this.daemon.config.name}] Error generating response:`, error)
    }
  }
}
