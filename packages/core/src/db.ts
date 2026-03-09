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

    await mkdir(dirname(this.config.path), { recursive: true })
    await mkdir(this.config.path, { recursive: true })

    this.connection = await lanceConnect(this.config.path)
    this._connected = true

    // Initialize all tables
    await this.ensureTable('conversations', [{
      id: 'init', channelKey: '', scope: '', role: 'system',
      content: 'Database initialized', timestamp: new Date().toISOString(),
    }])

    await this.ensureTable('todos', [{
      id: 'init', title: '', description: '', assignee: '', status: 'done',
      priority: 'low', project: '', dependsOn: '', createdBy: 'system',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }])

    await this.ensureTable('todo_comments', [{
      id: 'init', todoId: '', author: '', content: '',
      type: 'system', timestamp: new Date().toISOString(),
    }])

    await this.ensureTable('budget_records', [{
      id: 'init', agentName: 'system', model: '',
      inputTokens: 0, outputTokens: 0, costUsd: 0,
      timestamp: new Date().toISOString(),
    }])

    await this.ensureTable('agent_registry', [{
      name: 'system', state: 'stopped',
      lastSeen: new Date().toISOString(), bootedAt: new Date().toISOString(),
    }])
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return
    this.tables.clear()
    this.connection = null
    this._connected = false
  }

  isConnected(): boolean { return this._connected }
  get path(): string { return this.config.path }

  // =========================================================================
  // Conversations
  // =========================================================================

  async addMessage(channelKey: string, scope: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const table = await this.getTable('conversations')
    await table.add([{
      id: crypto.randomUUID(), channelKey, scope, role, content,
      timestamp: new Date().toISOString(),
    }])
  }

  async getHistory(channelKey: string, scope: string, limit: number = 50): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const table = await this.getTable('conversations')
    try {
      const results = await table
        .where(`channelKey = '${channelKey}' AND scope = '${scope}' AND role != 'system'`)
        .limit(limit)
        .execute()
      return results
        .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp))
        .map((r: any) => ({ role: r.role, content: r.content }))
    } catch {
      return []
    }
  }

  // =========================================================================
  // Todos — with dependencies, projects, and comment/escalate flow
  // =========================================================================

  async addTodo(todo: {
    title: string
    description: string
    assignee: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    createdBy: string
    project?: string
    dependsOn?: string[]  // todo IDs that must complete before this one
  }): Promise<string> {
    const table = await this.getTable('todos')
    const id = crypto.randomUUID().slice(0, 8) // Short IDs for readability
    await table.add([{
      id,
      title: todo.title,
      description: todo.description,
      assignee: todo.assignee,
      status: 'pending',
      priority: todo.priority,
      project: todo.project ?? '',
      dependsOn: (todo.dependsOn ?? []).join(','), // CSV in LanceDB
      createdBy: todo.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: '',
    }])
    return id
  }

  async getTodo(id: string): Promise<any | null> {
    const table = await this.getTable('todos')
    try {
      const results = await table.where(`id = '${id}'`).execute()
      return results.length > 0 ? results[0] : null
    } catch {
      return null
    }
  }

  async getTodos(filter?: { assignee?: string; status?: string; project?: string }): Promise<any[]> {
    const table = await this.getTable('todos')
    try {
      let filterStr = "id != 'init'"
      if (filter?.assignee) filterStr += ` AND assignee = '${filter.assignee}'`
      if (filter?.status) filterStr += ` AND status = '${filter.status}'`
      if (filter?.project) filterStr += ` AND project = '${filter.project}'`
      return await table.where(filterStr).execute()
    } catch {
      return []
    }
  }

  async updateTodo(id: string, updates: {
    status?: string
    assignee?: string
    priority?: string
    title?: string
    description?: string
  }): Promise<void> {
    const table = await this.getTable('todos')
    try {
      const existing = await table.where(`id = '${id}'`).execute()
      if (existing.length === 0) return
      const record = existing[0]
      await table.delete(`id = '${id}'`)
      await table.add([{
        ...record,
        ...updates,
        updatedAt: new Date().toISOString(),
        completedAt: updates.status === 'done' ? new Date().toISOString() : record.completedAt,
      }])
    } catch {}
  }

  async deleteTodo(id: string): Promise<void> {
    const table = await this.getTable('todos')
    try { await table.delete(`id = '${id}'`) } catch {}
  }

  // Check if a todo's dependencies are all complete
  async areDependenciesMet(id: string): Promise<boolean> {
    const todo = await this.getTodo(id)
    if (!todo || !todo.dependsOn) return true

    const depIds = todo.dependsOn.split(',').filter(Boolean)
    if (depIds.length === 0) return true

    for (const depId of depIds) {
      const dep = await this.getTodo(depId)
      if (!dep || dep.status !== 'done') return false
    }
    return true
  }

  // =========================================================================
  // Todo Comments — agents comment on todos, which escalates to orchestrator
  // =========================================================================

  async addComment(todoId: string, author: string, content: string, type: 'comment' | 'escalation' | 'resolution' = 'comment'): Promise<string> {
    const table = await this.getTable('todo_comments')
    const id = crypto.randomUUID().slice(0, 8)
    await table.add([{
      id, todoId, author, content, type,
      timestamp: new Date().toISOString(),
    }])
    return id
  }

  async getComments(todoId: string): Promise<Array<{ id: string; author: string; content: string; type: string; timestamp: string }>> {
    const table = await this.getTable('todo_comments')
    try {
      const results = await table.where(`todoId = '${todoId}'`).execute()
      return results
        .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp))
        .map((r: any) => ({ id: r.id, author: r.author, content: r.content, type: r.type, timestamp: r.timestamp }))
    } catch {
      return []
    }
  }

  // =========================================================================
  // Budget Records
  // =========================================================================

  async recordCost(record: {
    agentName: string; model: string;
    inputTokens: number; outputTokens: number; costUsd: number
  }): Promise<void> {
    const table = await this.getTable('budget_records')
    await table.add([{
      id: crypto.randomUUID(), ...record,
      timestamp: new Date().toISOString(),
    }])
  }

  async getTotalCostToday(agentName?: string): Promise<number> {
    const table = await this.getTable('budget_records')
    try {
      const today = new Date().toISOString().split('T')[0]
      let filterStr = `timestamp >= '${today}'`
      if (agentName) filterStr += ` AND agentName = '${agentName}'`
      const records = await table.where(filterStr).execute()
      return records.reduce((sum: number, r: any) => sum + (r.costUsd || 0), 0)
    } catch {
      return 0
    }
  }

  // =========================================================================
  // Agent Registry
  // =========================================================================

  async registerAgent(name: string): Promise<void> {
    const table = await this.getTable('agent_registry')
    try { await table.delete(`name = '${name}'`) } catch {}
    await table.add([{
      name, state: 'running',
      lastSeen: new Date().toISOString(), bootedAt: new Date().toISOString(),
    }])
  }

  async updateAgentHeartbeat(name: string): Promise<void> {
    const table = await this.getTable('agent_registry')
    try {
      const existing = await table.where(`name = '${name}'`).execute()
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
      return (await table.where("name != 'system'").execute()).map((r: any) => ({
        name: r.name, state: r.state, lastSeen: r.lastSeen,
      }))
    } catch {
      return []
    }
  }

  // =========================================================================
  // Internals
  // =========================================================================

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
