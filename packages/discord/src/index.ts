// ============================================================================
// @edenup/discord — Discord Messaging Adapter
// ============================================================================
// Implements @edenup/messaging's MessagingAdapter using discord.js v14.
//
// Usage:
//   import { DiscordAdapter } from '@edenup/discord'
//
//   const discord = new DiscordAdapter({
//     botToken: process.env.DISCORD_BOT_TOKEN!,
//     guildId: process.env.DISCORD_GUILD_ID!,
//   })

import {
  Client,
  GatewayIntentBits,
  Guild,
} from 'discord.js'

import type {
  MessagingAdapter,
  ChannelHandle,
  MessageHandle,
  ThreadHandle,
  MessageContent,
  ServerLayout,
  ServerHandles,
  ChannelPermissions,
  ReactionCallback,
  MessageCallback,
  MentionCallback,
  Unsubscribe,
} from '@edenup/messaging'

export interface DiscordAdapterConfig {
  botToken: string
  guildId: string
}

export class DiscordAdapter implements MessagingAdapter {
  readonly name = 'discord' as const

  private config: DiscordAdapterConfig
  private client: Client
  private guild?: Guild

  constructor(config: DiscordAdapterConfig) {
    this.config = config
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
    })
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('clientReady', async () => {
        try {
          console.log(`Discord client ready as ${this.client.user?.tag}`)
          this.guild = await this.client.guilds.fetch(this.config.guildId)
          console.log(`Connected to Discord server: ${this.guild.name} (${this.guild.id})`)
          resolve()
        } catch (error) {
          console.error(`Failed to fetch guild ${this.config.guildId}:`, error)
          reject(error)
        }
      })

      this.client.once('error', (error) => {
        reject(error)
      })

      // Setup global message logger
      this.client.on('messageCreate', (message) => {
        if (message.guild?.id !== this.config.guildId) return

        const channelName = message.channel.isDMBased() ? 'DM' : message.channel.name
        const author = message.author.bot ? `[BOT] ${message.author.username}` : message.author.username
        
        console.log(`[Discord|#${channelName}] ${author}: ${message.content}`)
      })

      this.client.login(this.config.botToken).catch(reject)
    })
  }

  async disconnect(): Promise<void> {
    await this.client.destroy()
  }

  async setupServer(config: ServerLayout): Promise<ServerHandles> {
    // TODO: For each category in config:
    //   - Find or create the category channel
    //   - For each channel name in the category:
    //     - Find or create the text channel under that category
    // TODO: Return handles map
    return {
      channels: new Map(),
      categories: new Map(),
    }
  }

  async createChannel(name: string, category: string): Promise<ChannelHandle> {
    // TODO: Find the category, create a text channel under it
    return { id: '', name, platform: 'discord' }
  }

  async deleteChannel(handle: ChannelHandle): Promise<void> {
    // TODO: Fetch and delete the channel
  }

  async setChannelPermissions(
    handle: ChannelHandle,
    permissions: ChannelPermissions,
  ): Promise<void> {
    // TODO: Set Discord permission overwrites on the channel
    // Map user IDs to Discord permission overwrites:
    //   visibleTo → ViewChannel: true
    //   writableTo → ViewChannel: true, SendMessages: true
    //   readonlyTo → ViewChannel: true, SendMessages: false
  }

  async sendMessage(channel: ChannelHandle, content: MessageContent): Promise<MessageHandle> {
    const authorTag = content.author ? `[${content.author.name}] ` : ''
    console.log(`[Discord|Out|#${channel.name}] ${authorTag}${content.text}`)
    
    if (!this.client || !this.client.isReady()) {
      throw new Error('Discord client not ready')
    }

    const discordChannel = await this.client.channels.fetch(channel.id)
    if (!discordChannel) {
      throw new Error(`Channel ${channel.id} not found`)
    }

    // Use Webhooks if a custom author is provided
    if (content.author && 'fetchWebhooks' in discordChannel) {
      let webhookChannel = discordChannel as any
      let threadId: string | undefined = undefined

      // Webhooks belong to the parent channel, but can send into threads
      if ('isThread' in discordChannel && (discordChannel as any).isThread() && (discordChannel as any).parent) {
        webhookChannel = (discordChannel as any).parent
        threadId = discordChannel.id
      }

      try {
        const webhooks = await webhookChannel.fetchWebhooks()
        let webhook = webhooks.find((w: any) => w.owner?.id === this.client.user?.id)
        
        if (!webhook) {
          webhook = await webhookChannel.createWebhook({
            name: 'Eden Webhook',
          })
        }

        const sent = await webhook.send({
          content: content.text,
          username: content.author.name,
          avatarURL: content.author.avatarUrl,
          threadId,
        })

        return { id: sent.id, channelId: channel.id, platform: 'discord' }
      } catch (error) {
        console.error('[Discord] Failed to send via webhook, falling back to normal send:', error)
      }
    }

    // Fallback or normal send
    if (!('send' in discordChannel)) {
      throw new Error(`Channel ${channel.id} is not a text-based channel`)
    }

    const sent = await (discordChannel as any).send({
      content: content.text,
    })

    return { id: sent.id, channelId: sent.channelId, platform: 'discord' }
  }

  async editMessage(handle: MessageHandle, content: MessageContent): Promise<void> {
    // TODO: Fetch message, edit it
    // NOTE: This should go through a throttled queue (throttleMs per channel)
    //       The throttle layer lives in @edenup/core, not here — this adapter
    //       is the raw interface. Core wraps it with throttling.
  }

  async deleteMessage(handle: MessageHandle): Promise<void> {
    // TODO: Fetch and delete message
  }

  async pinMessage(handle: MessageHandle): Promise<void> {
    // TODO: Fetch and pin message
  }

  async createThread(parentMessage: MessageHandle, name: string): Promise<ThreadHandle> {
    // TODO: Fetch parent message, create a public thread off it
    return {
      id: '',
      parentMessageId: parentMessage.id,
      channelId: parentMessage.channelId,
      platform: 'discord',
    }
  }

  async sendToThread(thread: ThreadHandle, content: MessageContent): Promise<MessageHandle> {
    // TODO: Fetch thread channel, send message to it
    return { id: '', channelId: thread.id, platform: 'discord' }
  }

  async addReaction(message: MessageHandle, emoji: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(message.channelId)
      if (!channel || !('messages' in channel)) return
      const msg = await (channel as any).messages.fetch(message.id)
      await msg.react(emoji)
    } catch (error) {
      console.error('[Discord] Failed to add reaction:', error)
    }
  }

  async removeReaction(message: MessageHandle, emoji: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(message.channelId)
      if (!channel || !('messages' in channel)) return
      const msg = await (channel as any).messages.fetch(message.id)
      const reaction = msg.reactions.cache.find((r: any) => r.emoji.name === emoji)
      if (reaction) {
        await reaction.users.remove(this.client.user?.id)
      }
    } catch (error) {
      console.error('[Discord] Failed to remove reaction:', error)
    }
  }

  async startTyping(channel: ChannelHandle): Promise<void> {
    try {
      const discordChannel = await this.client.channels.fetch(channel.id)
      if (discordChannel && 'sendTyping' in discordChannel) {
        await (discordChannel as any).sendTyping()
      }
    } catch (error) {
      console.error('[Discord] Failed to start typing:', error)
    }
  }

  onReaction(message: MessageHandle, callback: ReactionCallback): Unsubscribe {
    // TODO: Listen for 'messageReactionAdd' events on this message
    // TODO: Filter by message ID, call callback with event
    return () => {}
  }

  onMessage(channel: ChannelHandle, callback: MessageCallback): Unsubscribe {
    const handler = (message: any) => {
      if (message.guild?.id !== this.config.guildId) return
      if (message.author.bot) return // Ignore other bots (and ourselves)
      if (message.channelId !== channel.id) return

      const mentions = Array.from(message.mentions.users.values()).map((u: any) => u.id)
      
      callback({
        id: message.id,
        channelId: message.channelId,
        userId: message.author.id,
        content: message.content,
        mentions,
        isThread: message.channel.isThread(),
        threadId: message.channel.isThread() ? message.channel.id : undefined,
      })
    }

    this.client.on('messageCreate', handler)
    return () => this.client.off('messageCreate', handler)
  }

  onMention(botName: string, callback: MentionCallback, isOrchestrator: boolean = false): Unsubscribe {
    const handler = (message: any) => {
      if (message.guild?.id !== this.config.guildId) return
      if (message.author.bot) return

      // Did they @mention the Discord bot user directly?
      const mentionedBotUser = message.mentions.users.has(this.client.user?.id)
      
      // Did they type @botName in the message text? (e.g. @nova, @parcae)
      const mentionedByName = new RegExp(`@${botName}\\b`, 'i').test(message.content)

      // Orchestrator: responds to direct bot-user @mentions OR text @parcae
      // Regular agents: respond ONLY to text @name mentions (not bot-user @mentions)
      if (isOrchestrator) {
        if (!mentionedBotUser && !mentionedByName) return
      } else {
        if (!mentionedByName) return
      }

      const mentions = Array.from(message.mentions.users.values()).map((u: any) => u.id)

      callback({
        id: message.id,
        channelId: message.channelId,
        userId: message.author.id,
        content: message.content,
        mentions,
        isThread: message.channel.isThread(),
        threadId: message.channel.isThread() ? message.channel.id : undefined,
      })
    }

    this.client.on('messageCreate', handler)
    return () => this.client.off('messageCreate', handler)
  }

  formatCollapsible(summary: string, detail: string): string {
    // Discord: use spoiler tags for collapsible content
    return `${summary}\n||${detail}||`
  }
}
