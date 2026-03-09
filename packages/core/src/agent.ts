// ============================================================================
// @edenup/core — Worker Agent
// ============================================================================

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Daemon } from './daemon.js'
import type { EdenConfig, AgentConfig } from './types.js'
import type { Database } from './db.js'
import type { MessagingAdapter, IncomingMessage } from '@edenup/messaging'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { ToolLoopAgent } from 'ai'

export class WorkerAgent {
  private daemon: Daemon
  private edenConfig: EdenConfig
  private db: Database
  private agentMd: string = ''

  constructor(
    config: EdenConfig,
    agentConfig: AgentConfig,
    messaging: MessagingAdapter[],
    db: Database,
  ) {
    this.edenConfig = config
    this.db = db

    this.daemon = new Daemon(agentConfig, messaging, {
      onStateChange: async () => {},
      onHeartbeat: async () => {},
      onError: async () => {},
      onTask: async () => {},
    })
  }

  async boot(): Promise<void> {
    // Load AGENT.md from the agent's directory
    const agentDir = join(resolve(process.cwd(), this.edenConfig.paths.agents), this.daemon.config.name)
    try {
      this.agentMd = await readFile(join(agentDir, 'AGENT.md'), 'utf-8')
    } catch {
      this.agentMd = `You are ${this.daemon.config.name}. ${this.daemon.config.description}\n\n${this.daemon.config.personality}`
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

    const openrouter = createOpenRouter({
      apiKey: this.edenConfig.llm.openrouter.apiKey,
    })

    const modelName = this.daemon.config.router.default
    console.log(`[Agent:${agentName}] Processing mention using model ${modelName}...`)

    await adapter.addReaction(msgHandle, '🤔')
    await adapter.removeReaction(msgHandle, '👀')
    await adapter.startTyping(channelHandle)

    // Conversation history from DB
    const channelKey = `${adapterName}:${message.channelId}`
    await this.db.addMessage(channelKey, agentName, 'user', message.content)
    let history = await this.db.getHistory(channelKey, agentName, 50)
    if (history.length === 0) {
      history = [{ role: 'user' as const, content: message.content }]
    }

    try {
      const agent = new ToolLoopAgent({
        model: openrouter(modelName),
        instructions: this.agentMd,
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
      console.error(`[Agent:${agentName}] Error generating response:`, error)
      await adapter.removeReaction(msgHandle, '🤔')
      await adapter.addReaction(msgHandle, '❌')
    }
  }
}
