// ============================================================================
// @edenup/core — Types
// ============================================================================

// --- Eden Config (no messaging — adapters are composed externally) ---

export interface EdenConfig {
  access: AccessConfig
  budget: MetaBudgetConfig
  llm: LLMConfig
  workspaces: WorkspaceConfig[]
  inbox: InboxConfig
  paths: PathsConfig
}

export interface AccessConfig {
  owner: string
  roles: Record<RoleName, RoleConfig>
}

export type RoleName = 'admin' | 'operator' | 'viewer' | 'guest'

export interface RoleConfig {
  userIds: string[]
  canApprove?: boolean
  canCommand?: boolean
  canViewVerbose?: boolean
  canViewControl?: boolean
}

export interface MetaBudgetConfig {
  maxPerDay: number
  maxLifetime: number
  warnAt: number
}

export interface LLMConfig {
  providers: Record<string, { apiKey: string }>
  defaultProvider: string
}

export interface WorkspaceConfig {
  name: string
  agents: string[]
}

export interface InboxConfig {
  ownerWakesAgent: boolean
  humanPriority: boolean
}

export interface PathsConfig {
  agents: string
  skills: string
  data: string
}

// --- Agent Config ---

export interface AgentConfig {
  name: string
  description: string
  personality: string

  messaging: AgentMessagingConfig
  router: AgentRouterConfig
  budget: AgentBudgetConfig
  daemon: AgentDaemonConfig
  approval: AgentApprovalConfig
  tools: AgentToolsConfig
  skills: AgentSkillsConfig
  context?: AgentContextConfig
}

export interface AgentMessagingConfig {
  channelName: string
  verboseChannelName: string
  threadPerTask: boolean
  updateMode: 'edit' | 'append'
  statusEmoji: string
  throttleMs: number
  verboseCollapsible: boolean
}

export interface AgentRouterConfig {
  default: string
  planning?: string
  cheap?: string
  routes: Record<string, string>
}

export interface AgentBudgetConfig {
  maxPerDay: number
  maxPerTask: number
  maxLifetime: number
  warnAt: number
  onExhausted: 'pause' | 'kill' | 'escalate'
}

export interface AgentDaemonConfig {
  mode: 'loop' | 'event' | 'cron'
  heartbeatIntervalMs: number
  maxConsecutiveErrors: number
  restartDelayMs: number
  schedule?: string
  loopDelayMs?: number
}

export interface AgentApprovalConfig {
  alwaysApprove: string[]
  approveAbove: { costUsd: number }
  timeoutMs: number
  onTimeout: 'skip' | 'escalate' | 'proceed'
}

export interface AgentToolsConfig {
  builtin: string[]
  mcp: Array<{
    name: string
    url?: string
    command?: string
    args?: string[]
  }>
}

export interface AgentSkillsConfig {
  local: string[]
  global: string[]
}

export interface AgentContextConfig {
  maxTokens: number
  compactionThreshold: number
  adapters: {
    memory?: { enabled: boolean; maxFragments: number; maxTokens: number }
    summary?: { enabled: boolean; maxTokens: number }
    meeting?: { enabled: boolean; maxTokens: number; lookbackDays: number }
    compaction?: { enabled: boolean; model: string }
  }
}

// --- Daemon States ---

export type DaemonState =
  | 'booting'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error'

// --- Meetings ---

export interface Meeting {
  id: string
  goal: string
  initiator: string
  participants: string[]
  status: 'assembling' | 'in_session' | 'concluded' | 'escalated'
  topics: MeetingTopic[]
  actionItems: ActionItem[]
  budget: { maxCostUsd: number; currentCostUsd: number }
  createdAt: Date
  concludedAt?: Date
  messaging: {
    lobbyMessageId: string
    threadId: string
  }
}

export interface MeetingTopic {
  id: string
  title: string
  proposedBy: string
  status: 'open' | 'decided' | 'escalated' | 'deferred'
  messages: MeetingMessage[]
  decision?: string
  escalation?: {
    reason: string
    options: string[]
    humanResponse?: string
  }
  separatorMessageId?: string
}

export interface MeetingMessage {
  agent: string
  content: string
  timestamp: Date
  topicId: string
  type: 'contribution' | 'question' | 'proposal' | 'decision' | 'escalation'
}

export interface ActionItem {
  assignee: string
  description: string
  fromTopicId: string
  deadline?: Date
}

// --- Tool Discovery ---

export interface ToolRequest {
  id: string
  agentName: string
  toolName: string
  reason: string
  status: 'pending' | 'researching' | 'building' | 'approved' | 'denied'
  resolution?: ToolResolution
  messageId?: string
}

export interface ToolResolution {
  type: 'first-party-mcp' | 'self-built-mcp' | 'builtin-tool'
  source: string
  mcpConfig?: {
    name: string
    url?: string
    command?: string
    args?: string[]
  }
  requiresSecrets?: string[]
  requiresHumanApproval: boolean
}

// --- Sub-Agents ---

export interface SubAgentRequest {
  task: string
  budgetUsd: number
  model?: string
  tools?: string[]
  skills?: string[]
  timeoutMs?: number
}

export interface SubAgentResult {
  status: 'completed' | 'timeout' | 'error' | 'budget_exceeded'
  output: string
  costUsd: number
  durationMs: number
}

// --- Context ---

export interface ContextFragment {
  source: string
  content: string
  tokens: number
  relevance: number
}

export interface CompactedContext {
  summary: string
  preservedMessages: unknown[]
  tokensFreed: number
}

// --- Memory ---

export interface AgentMemory {
  id: string
  agentName: string
  content: string
  embedding: number[]
  taskId: string
  createdAt: Date
  lastAccessedAt: Date
  accessCount: number
  tags: string[]
}

// --- Inbox ---

export interface InboxMessage {
  id: string
  agentName: string
  fromUserId: string
  fromUserRole: RoleName | 'owner'
  channelId: string
  content: string
  priority: number
  createdAt: Date
  processedAt?: Date
  status: 'queued' | 'processing' | 'completed'
}
