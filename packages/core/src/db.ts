// ============================================================================
// @edenup/core — Database (LanceDB)
// ============================================================================
// All column names are lowercase (no camelCase) because LanceDB/DataFusion
// normalizes identifiers to lowercase in SQL WHERE clauses.

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

    await this.ensureTable('conversations', [{
      id: 'init', channel: '', scope: '', role: 'system',
      content: 'Database initialized', ts: new Date().toISOString(),
    }])

    await this.ensureTable('todos', [{
      id: 'init', title: '', description: '', assignee: '', status: 'done',
      priority: 'low', project: '', depends: '', creator: 'system',
      created: new Date().toISOString(), updated: new Date().toISOString(),
      completed: new Date().toISOString(),
    }])

    await this.ensureTable('comments', [{
      id: 'init', todo: '', author: '', content: '',
      type: 'system', ts: new Date().toISOString(),
    }])

    await this.ensureTable('costs', [{
      id: 'init', agent: 'system', model: '',
      input: 0, output: 0, cost: 0,
      ts: new Date().toISOString(),
    }])

    await this.ensureTable('agents', [{
      name: 'system', state: 'stopped',
      seen: new Date().toISOString(), booted: new Date().toISOString(),
    }])

    await this.ensureTable('crons', [{
      id: 'init', name: '', schedule: '', assignee: '',
      description: '', enabled: 'false', lastran: '', nextrun: '',
      created: new Date().toISOString(),
    }])

    await this.ensureTable('jobs', [{
      id: 'init', type: '', ref: '', assignee: '',
      status: 'done', result: '', error: '',
      started: new Date().toISOString(), finished: new Date().toISOString(),
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

  async addMessage(channel: string, scope: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const table = await this.getTable('conversations')
    await table.add([{
      id: crypto.randomUUID(), channel, scope, role, content,
      ts: new Date().toISOString(),
    }])
  }

  async getHistory(channel: string, scope: string, limit: number = 50): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const table = await this.getTable('conversations')
    try {
      const results = await table
        .where(`channel = '${channel}' AND scope = '${scope}' AND role != 'system'`)
        .limit(limit)
        .execute()
      return results
        .sort((a: any, b: any) => a.ts.localeCompare(b.ts))
        .map((r: any) => ({ role: r.role, content: r.content }))
    } catch {
      return []
    }
  }

  // =========================================================================
  // Todos
  // =========================================================================

  async addTodo(todo: {
    title: string
    description: string
    assignee: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    createdBy: string
    project?: string
    dependsOn?: string[]
  }): Promise<string> {
    const table = await this.getTable('todos')
    const id = crypto.randomUUID().slice(0, 8)
    await table.add([{
      id,
      title: todo.title,
      description: todo.description,
      assignee: todo.assignee,
      status: 'pending',
      priority: todo.priority,
      project: todo.project ?? '',
      depends: (todo.dependsOn ?? []).join(','),
      creator: todo.createdBy,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      completed: '',
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
      let f = "id != 'init'"
      if (filter?.assignee) f += ` AND assignee = '${filter.assignee}'`
      if (filter?.status) f += ` AND status = '${filter.status}'`
      if (filter?.project) f += ` AND project = '${filter.project}'`
      return await table.where(f).execute()
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
        updated: new Date().toISOString(),
        completed: updates.status === 'done' ? new Date().toISOString() : record.completed,
      }])
    } catch {}
  }

  async deleteTodo(id: string): Promise<void> {
    const table = await this.getTable('todos')
    try { await table.delete(`id = '${id}'`) } catch {}
  }

  async areDependenciesMet(id: string): Promise<boolean> {
    const todo = await this.getTodo(id)
    if (!todo || !todo.depends) return true
    const depIds = todo.depends.split(',').filter(Boolean)
    if (depIds.length === 0) return true
    for (const depId of depIds) {
      const dep = await this.getTodo(depId)
      if (!dep || dep.status !== 'done') return false
    }
    return true
  }

  // =========================================================================
  // Comments
  // =========================================================================

  async addComment(todoId: string, author: string, content: string, type: 'comment' | 'escalation' | 'resolution' = 'comment'): Promise<string> {
    const table = await this.getTable('comments')
    const id = crypto.randomUUID().slice(0, 8)
    await table.add([{
      id, todo: todoId, author, content, type,
      ts: new Date().toISOString(),
    }])
    return id
  }

  async getComments(todoId: string): Promise<Array<{ id: string; author: string; content: string; type: string; ts: string }>> {
    const table = await this.getTable('comments')
    try {
      const results = await table.where(`todo = '${todoId}'`).execute()
      return results
        .sort((a: any, b: any) => a.ts.localeCompare(b.ts))
        .map((r: any) => ({ id: r.id, author: r.author, content: r.content, type: r.type, ts: r.ts }))
    } catch {
      return []
    }
  }

  // =========================================================================
  // Costs
  // =========================================================================

  async recordCost(record: {
    agentName: string; model: string;
    inputTokens: number; outputTokens: number; costUsd: number
  }): Promise<void> {
    const table = await this.getTable('costs')
    await table.add([{
      id: crypto.randomUUID(),
      agent: record.agentName, model: record.model,
      input: record.inputTokens, output: record.outputTokens, cost: record.costUsd,
      ts: new Date().toISOString(),
    }])
  }

  async getTotalCostToday(agentName?: string): Promise<number> {
    const table = await this.getTable('costs')
    try {
      const today = new Date().toISOString().split('T')[0]
      let f = `ts >= '${today}'`
      if (agentName) f += ` AND agent = '${agentName}'`
      const records = await table.where(f).execute()
      return records.reduce((sum: number, r: any) => sum + (r.cost || 0), 0)
    } catch {
      return 0
    }
  }

  // =========================================================================
  // Agent Registry
  // =========================================================================

  async registerAgent(name: string): Promise<void> {
    const table = await this.getTable('agents')
    try { await table.delete(`name = '${name}'`) } catch {}
    await table.add([{
      name, state: 'running',
      seen: new Date().toISOString(), booted: new Date().toISOString(),
    }])
  }

  async updateAgentHeartbeat(name: string): Promise<void> {
    const table = await this.getTable('agents')
    try {
      const existing = await table.where(`name = '${name}'`).execute()
      if (existing.length === 0) return
      const record = existing[0]
      await table.delete(`name = '${name}'`)
      await table.add([{ ...record, seen: new Date().toISOString() }])
    } catch {}
  }

  async unregisterAgent(name: string): Promise<void> {
    const table = await this.getTable('agents')
    try { await table.delete(`name = '${name}'`) } catch {}
  }

  async getRegisteredAgents(): Promise<Array<{ name: string; state: string; seen: string }>> {
    const table = await this.getTable('agents')
    try {
      return (await table.where("name != 'system'").execute()).map((r: any) => ({
        name: r.name, state: r.state, seen: r.seen,
      }))
    } catch {
      return []
    }
  }

  // =========================================================================
  // Crons
  // =========================================================================

  async addCron(cron: {
    name: string
    schedule: string
    assignee: string
    description: string
  }): Promise<string> {
    const table = await this.getTable('crons')
    const id = crypto.randomUUID().slice(0, 8)
    await table.add([{
      id, name: cron.name, schedule: cron.schedule,
      assignee: cron.assignee, description: cron.description,
      enabled: 'true', lastran: '', nextrun: '',
      created: new Date().toISOString(),
    }])
    return id
  }

  async getCrons(enabledOnly = true): Promise<any[]> {
    const table = await this.getTable('crons')
    try {
      const filter = enabledOnly ? "id != 'init' AND enabled = 'true'" : "id != 'init'"
      return await table.where(filter).execute()
    } catch { return [] }
  }

  async updateCronLastRan(id: string, nextrun: string): Promise<void> {
    const table = await this.getTable('crons')
    try {
      const existing = await table.where(`id = '${id}'`).execute()
      if (existing.length === 0) return
      const record = existing[0]
      await table.delete(`id = '${id}'`)
      await table.add([{ ...record, lastran: new Date().toISOString(), nextrun }])
    } catch {}
  }

  async deleteCron(id: string): Promise<void> {
    const table = await this.getTable('crons')
    try { await table.delete(`id = '${id}'`) } catch {}
  }

  // =========================================================================
  // Jobs — tracks what's been dispatched, prevents duplicate runs
  // =========================================================================

  async addJob(job: {
    type: 'todo' | 'cron' | 'orchestrator'
    ref: string         // todo ID, cron ID, or 'review'
    assignee: string
  }): Promise<string> {
    const table = await this.getTable('jobs')
    const id = crypto.randomUUID().slice(0, 8)
    await table.add([{
      id, type: job.type, ref: job.ref, assignee: job.assignee,
      status: 'running', result: '', error: '',
      started: new Date().toISOString(), finished: '',
    }])
    return id
  }

  async isJobRunning(type: string, ref: string): Promise<boolean> {
    const table = await this.getTable('jobs')
    try {
      const rows = await table.where(`type = '${type}' AND ref = '${ref}' AND status = 'running'`).execute()
      return rows.length > 0
    } catch { return false }
  }

  async completeJob(id: string, result: string): Promise<void> {
    const table = await this.getTable('jobs')
    try {
      const existing = await table.where(`id = '${id}'`).execute()
      if (existing.length === 0) return
      const record = existing[0]
      await table.delete(`id = '${id}'`)
      await table.add([{ ...record, status: 'done', result, finished: new Date().toISOString() }])
    } catch {}
  }

  async failJob(id: string, error: string): Promise<void> {
    const table = await this.getTable('jobs')
    try {
      const existing = await table.where(`id = '${id}'`).execute()
      if (existing.length === 0) return
      const record = existing[0]
      await table.delete(`id = '${id}'`)
      await table.add([{ ...record, status: 'failed', error, finished: new Date().toISOString() }])
    } catch {}
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
