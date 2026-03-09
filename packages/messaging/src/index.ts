// ============================================================================
// @edenup/messaging — Messaging Adapter Interface
// ============================================================================
// Platform-agnostic messaging layer. Adapters (Discord, Slack, etc.) implement
// this interface. Eden core depends only on this package, never on a specific
// adapter — the user composes adapters at the entrypoint.

export type Unsubscribe = () => void

// --- Handles ---

export interface ChannelHandle {
  id: string
  name: string
  platform: string
}

export interface MessageHandle {
  id: string
  channelId: string
  platform: string
}

export interface ThreadHandle {
  id: string
  parentMessageId: string
  channelId: string
  platform: string
}

// --- Content ---

export interface Embed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
}

export interface MessageContent {
  text: string
  embeds?: Embed[]
  collapsible?: boolean
  author?: {
    name: string
    avatarUrl?: string
  }
}

// --- Server Layout ---

export interface ServerLayout {
  categories: Array<{
    name: string
    channels: string[]
  }>
}

export interface ServerHandles {
  channels: Map<string, ChannelHandle>
  categories: Map<string, string>
}

// --- Permissions ---

export interface ChannelPermissions {
  visibleTo: string[]
  writableTo: string[]
  readonlyTo: string[]
}

// --- Events ---

export interface ReactionEvent {
  messageId: string
  userId: string
  emoji: string
}

export interface IncomingMessage {
  id: string
  channelId: string
  userId: string
  content: string
  mentions: string[]
  isThread: boolean
  threadId?: string
}

export type ReactionCallback = (event: ReactionEvent) => void | Promise<void>
export type MessageCallback = (message: IncomingMessage) => void | Promise<void>
export type MentionCallback = (message: IncomingMessage) => void | Promise<void>

// --- The Adapter Interface ---

export interface MessagingAdapter {
  /** Adapter identifier, e.g. 'discord', 'slack', 'mattermost' */
  readonly name: string

  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>

  // Server/workspace setup
  setupServer(config: ServerLayout): Promise<ServerHandles>

  // Channels
  createChannel(name: string, category: string): Promise<ChannelHandle>
  deleteChannel(handle: ChannelHandle): Promise<void>
  setChannelPermissions(handle: ChannelHandle, permissions: ChannelPermissions): Promise<void>

  // Messages
  sendMessage(channel: ChannelHandle, content: MessageContent): Promise<MessageHandle>
  editMessage(handle: MessageHandle, content: MessageContent): Promise<void>
  deleteMessage(handle: MessageHandle): Promise<void>
  pinMessage(handle: MessageHandle): Promise<void>

  // Threads
  createThread(parentMessage: MessageHandle, name: string): Promise<ThreadHandle>
  sendToThread(thread: ThreadHandle, content: MessageContent): Promise<MessageHandle>

  // Reactions
  addReaction(message: MessageHandle, emoji: string): Promise<void>
  removeReaction(message: MessageHandle, emoji: string): Promise<void>
  onReaction(message: MessageHandle, callback: ReactionCallback): Unsubscribe

  // Typing indicator
  startTyping(channel: ChannelHandle): Promise<void>

  // Events
  onMessage(channel: ChannelHandle, callback: MessageCallback): Unsubscribe
  /**
   * Listen for @mentions of a specific agent name.
   * isOrchestrator=true means this handler also fires when the Discord bot user is @mentioned directly.
   * isOrchestrator=false means only text-based @name mentions trigger the callback.
   */
  onMention(botName: string, callback: MentionCallback, isOrchestrator?: boolean): Unsubscribe

  // Formatting
  formatCollapsible(summary: string, detail: string): string
}
