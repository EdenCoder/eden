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
  // private client: Client — discord.js Client
  // private guild: Guild — cached guild reference

  constructor(config: DiscordAdapterConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    // TODO: Initialize discord.js Client with required intents
    //   - GatewayIntentBits.Guilds
    //   - GatewayIntentBits.GuildMessages
    //   - GatewayIntentBits.GuildMessageReactions
    //   - GatewayIntentBits.MessageContent
    // TODO: Login with botToken
    // TODO: Wait for 'ready' event
    // TODO: Cache guild reference
  }

  async disconnect(): Promise<void> {
    // TODO: Destroy discord.js Client
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
    // TODO: Fetch channel, send message
    // TODO: If content.embeds, map to Discord MessageEmbed objects
    // TODO: If content.collapsible, wrap detail in spoiler tags
    return { id: '', channelId: channel.id, platform: 'discord' }
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
    // TODO: Listen for 'messageCreate' events in this channel
    // TODO: Map discord.js Message to IncomingMessage
    return () => {}
  }

  onMention(botId: string, callback: MentionCallback): Unsubscribe {
    // TODO: Listen for 'messageCreate' events across all channels
    // TODO: Filter to messages that @mention the bot
    // TODO: This powers workspace channels + direct agent interaction
    return () => {}
  }

  formatCollapsible(summary: string, detail: string): string {
    // Discord: use spoiler tags for collapsible content
    return `${summary}\n||${detail}||`
  }
}
