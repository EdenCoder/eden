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
    console.log(`[Discord|Out|#${channel.name}] ${content.text}`)
    if (!this.client || !this.client.isReady()) {
      throw new Error('Discord client not ready')
    }

    const discordChannel = await this.client.channels.fetch(channel.id)
    if (!discordChannel || !discordChannel.isTextBased()) {
      throw new Error(`Channel ${channel.id} not found or not text-based`)
    }

    const sent = await discordChannel.send({
      content: content.text,
      // We can map embeds here later
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
    // TODO: Fetch message, add reaction
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

  onMention(botName: string, callback: MentionCallback): Unsubscribe {
    const handler = (message: any) => {
      if (message.guild?.id !== this.config.guildId) return
      if (message.author.bot) return

      // Did they @mention the Discord bot user directly?
      const mentionedBot = message.mentions.users.has(this.client.user?.id)
      
      // Did they type @botName ? (e.g. @parcae)
      const mentionedText = new RegExp(`@${botName}\\b`, 'i').test(message.content)

      if (!mentionedBot && !mentionedText) return

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
