// ============================================================================
// @edenup/core — Database (LanceDB)
// ============================================================================

import { connect as lanceConnect } from 'vectordb'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DatabaseConfig {
  path: string
}

export class Database {
  private config: DatabaseConfig
  private connection: any = null
  private tables: Map<string, any> = new Map()
  private _connected = false

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    if (this._connected) return

    // Ensure data directory exists
    await mkdir(dirname(this.config.path), { recursive: true })
    await mkdir(this.config.path, { recursive: true })

    this.connection = await lanceConnect(this.config.path)
    this._connected = true

    // Initialize tables
    await this.ensureTable('conversations', [{
      id: 'init',
      channelKey: '',
      scope: '',
      role: 'system',
      content: 'Database initialized',
      timestamp: new Date().toISOString(),
    }])

    await this.ensureTable('todos', [{
      id: 'init',
      title: '',
      description: '',
      assignee: '',
      status: 'done',
      priority: 'low',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }])

    await this.ensureTable('budget_records', [{
      id: 'init',
      agentName: 'system',
      model: '',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      timestamp: new Date().toISOString(),
    }])

    await this.ensureTable('agent_registry', [{
      name: 'system',
      state: 'stopped',
      lastSeen: new Date().toISOString(),
      bootedAt: new Date().toISOString(),
    }])
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return
    this.tables.clear()
    this.connection = null
    this._connected = false
  }

  isConnected(): boolean {
    return this._connected
  }

  get path(): string {
    return this.config.path
  }

  // --- Conversations ---

  async addMessage(channelKey: string, scope: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const table = await this.getTable('conversations')
    await table.add([{
      id: crypto.randomUUID(),
      channelKey,
      scope,
      role,
      content,
      timestamp: new Date().toISOString(),
    }])
  }

  async getHistory(channelKey: string, scope: string, limit: number = 50): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const table = await this.getTable('conversations')
    try {
      const results = await table
        .filter(`channelKey = '${channelKey}' AND scope = '${scope}' AND role != 'system'`)
        .limit(limit)
        .execute()

      // Sort by timestamp and return
      return results
        .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp))
        .map((r: any) => ({ role: r.role, content: r.content }))
    } catch {
      return []
    }
  }

  // --- Todos ---

  async addTodo(todo: {
    title: string
    description: string
    assignee: string
    priority: 'low' | 'medium' | 'high'
    createdBy: string
  }): Promise<string> {
    const table = await this.getTable('todos')
    const id = crypto.randomUUID()
    await table.add([{
      id,
      title: todo.title,
      description: todo.description,
      assignee: todo.assignee,
      status: 'pending',
      priority: todo.priority,
      createdBy: todo.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: '',
    }])
    return id
  }

  async getTodos(filter?: { assignee?: string; status?: string }): Promise<any[]> {
    const table = await this.getTable('todos')
    try {
      let filterStr = "id != 'init'"
      if (filter?.assignee) filterStr += ` AND assignee = '${filter.assignee}'`
      if (filter?.status) filterStr += ` AND status = '${filter.status}'`

      return await table.filter(filterStr).execute()
    } catch {
      return []
    }
  }

  async updateTodo(id: string, updates: { status?: string; assignee?: string }): Promise<void> {
    // LanceDB doesn't have native UPDATE — we delete and re-add
    const table = await this.getTable('todos')
    try {
      const existing = await table.filter(`id = '${id}'`).execute()
      if (existing.length === 0) return

      const record = existing[0]
      await table.delete(`id = '${id}'`)
      await table.add([{
        ...record,
        ...updates,
        updatedAt: new Date().toISOString(),
        completedAt: updates.status === 'done' ? new Date().toISOString() : record.completedAt,
      }])
    } catch {
      // Silently fail — todo might not exist
    }
  }

  // --- Budget Records ---

  async recordCost(record: {
    agentName: string
    model: string
    inputTokens: number
    outputTokens: number
    costUsd: number
  }): Promise<void> {
    const table = await this.getTable('budget_records')
    await table.add([{
      id: crypto.randomUUID(),
      ...record,
      timestamp: new Date().toISOString(),
    }])
  }

  async getTotalCostToday(agentName?: string): Promise<number> {
    const table = await this.getTable('budget_records')
    try {
      const today = new Date().toISOString().split('T')[0]
      let filterStr = `timestamp >= '${today}'`
      if (agentName) filterStr += ` AND agentName = '${agentName}'`

      const records = await table.filter(filterStr).execute()
      return records.reduce((sum: number, r: any) => sum + (r.costUsd || 0), 0)
    } catch {
      return 0
    }
  }

  // --- Agent Registry ---

  async registerAgent(name: string): Promise<void> {
    const table = await this.getTable('agent_registry')
    // Remove old entry if exists
    try { await table.delete(`name = '${name}'`) } catch {}
    await table.add([{
      name,
      state: 'running',
      lastSeen: new Date().toISOString(),
      bootedAt: new Date().toISOString(),
    }])
  }

  async updateAgentHeartbeat(name: string): Promise<void> {
    const table = await this.getTable('agent_registry')
    try {
      const existing = await table.filter(`name = '${name}'`).execute()
      if (existing.length === 0) return
      const record = existing[0]
      await table.delete(`name = '${name}'`)
      await table.add([{ ...record, lastSeen: new Date().toISOString() }])
    } catch {}
  }

  async unregisterAgent(name: string): Promise<void> {
    const table = await this.getTable('agent_registry')
    try { await table.delete(`name = '${name}'`) } catch {}
  }

  async getRegisteredAgents(): Promise<Array<{ name: string; state: string; lastSeen: string }>> {
    const table = await this.getTable('agent_registry')
    try {
      return (await table.filter("name != 'system'").execute()).map((r: any) => ({
        name: r.name,
        state: r.state,
        lastSeen: r.lastSeen,
      }))
    } catch {
      return []
    }
  }

  // --- Internals ---

  private async getTable(name: string): Promise<any> {
    if (this.tables.has(name)) return this.tables.get(name)

    const table = await this.connection.openTable(name)
    this.tables.set(name, table)
    return table
  }

  private async ensureTable(name: string, seedData: any[]): Promise<void> {
    const existing = await this.connection.tableNames()
    if (!existing.includes(name)) {
      const table = await this.connection.createTable(name, seedData)
      this.tables.set(name, table)
    }
  }
}
