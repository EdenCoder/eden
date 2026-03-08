// @edenup/core — Database

// ============================================================================
// LanceDB Table Schemas
// ============================================================================
//
// agent_memories
//   id: string (primary key)
//   agentName: string (indexed)
//   content: string
//   embedding: float32[] (vector index, dimension TBD based on model)
//   taskId: string
//   createdAt: timestamp
//   lastAccessedAt: timestamp
//   accessCount: int32
//   tags: string[]
//
// budget_records
//   id: string (primary key)
//   agentName: string (indexed)
//   taskId: string
//   costUsd: float64
//   model: string
//   inputTokens: int32
//   outputTokens: int32
//   timestamp: timestamp
//
// meetings
//   id: string (primary key)
//   goal: string
//   initiator: string
//   participants: string[]
//   status: string
//   topics: json (serialized MeetingTopic[])
//   actionItems: json (serialized ActionItem[])
//   budgetMaxUsd: float64
//   budgetCurrentUsd: float64
//   createdAt: timestamp
//   concludedAt: timestamp (nullable)
//   lobbyMessageId: string
//   threadId: string
//
// tool_requests
//   id: string (primary key)
//   agentName: string (indexed)
//   toolName: string
//   reason: string
//   status: string
//   resolution: json (serialized ToolResolution, nullable)
//   messageId: string (nullable)
//
// approval_log
//   id: string (primary key)
//   agentName: string (indexed)
//   action: string
//   description: string
//   estimatedCostUsd: float64
//   status: string
//   requestedAt: timestamp
//   resolvedAt: timestamp (nullable)
//   resolvedBy: string (nullable)
//
// agent_state
//   agentName: string (primary key)
//   daemonState: string
//   lastHeartbeat: timestamp
//   consecutiveErrors: int32
//   currentTaskId: string (nullable)
//   metadata: json
//
// inbox_messages
//   id: string (primary key)
//   agentName: string (indexed)
//   fromUserId: string
//   fromUserRole: string
//   channelId: string
//   content: string
//   priority: int32
//   createdAt: timestamp
//   processedAt: timestamp (nullable)
//   status: string
//
// ============================================================================

export interface DatabaseConfig {
  path: string
}

/**
 * Wraps LanceDB for Eden's persistence layer. Provides connection
 * management and table access for all core modules.
 *
 * LanceDB is an embedded vector database — no server required.
 * Tables are created lazily on first access.
 */
export class Database {
  private config: DatabaseConfig
  private connection: unknown = null // TODO: Type as lancedb.Connection
  private connected = false

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  /**
   * Open the LanceDB database at the configured path.
   * Creates the directory and initial tables if they don't exist.
   */
  async connect(): Promise<void> {
    if (this.connected) return

    // TODO: Replace with actual LanceDB connection
    //   import { connect } from 'vectordb'
    //   this.connection = await connect(this.config.path)
    //
    // TODO: Create tables if they don't exist:
    //   - agent_memories (with vector index)
    //   - budget_records
    //   - meetings
    //   - tool_requests
    //   - approval_log
    //   - agent_state
    //   - inbox_messages

    this.connected = true
  }

  /**
   * Close the database connection gracefully.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return

    // TODO: Close LanceDB connection
    //   LanceDB connections are typically closed by dropping references,
    //   but we should flush any pending writes.

    this.connection = null
    this.connected = false
  }

  /**
   * Get a reference to a LanceDB table by name.
   * Returns the raw table handle for direct queries.
   */
  async table(name: string): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Database is not connected. Call connect() first.')
    }

    // TODO: return this.connection.openTable(name)
    throw new Error(`Table access not yet implemented: ${name}`)
  }

  /**
   * Check if the database is connected and responsive.
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get the database file path.
   */
  get path(): string {
    return this.config.path
  }
}
