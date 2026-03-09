// ============================================================================
// @edenup/core — Agent Daemon
// ============================================================================
// The main loop that keeps Eden alive. Runs on an interval and:
//
//   1. Dispatches pending todos to agents (idempotent — won't double-run)
//   2. Checks cron entries and fires due ones
//   3. When idle for too long, pokes the orchestrator to review status
//
// All dispatches are tracked as "jobs" in the DB to prevent duplicates.

import type { Database } from './db.js'
import type { WorkerAgent } from './agent.js'
import type { Orchestrator } from './orchestrator/index.js'
import type { MessagingAdapter } from '@edenup/messaging'
import { Logger } from './logger.js'

export interface AgentDaemonConfig {
  pollIntervalMs: number   // How often to tick (default: 10s)
  idleThresholdMs: number  // How long before we poke the orchestrator (default: 5min)
  channelId?: string       // Discord channel for broadcasts
}

export class AgentDaemon {
  private db: Database
  private agents: Map<string, WorkerAgent>
  private orchestrator: Orchestrator
  private adapters: MessagingAdapter[]
  private config: AgentDaemonConfig
  private logger: Logger
  private interval: ReturnType<typeof setInterval> | null = null
  private running = false
  private lastActivity: number = Date.now()

  constructor(
    db: Database,
    agents: Map<string, WorkerAgent>,
    orchestrator: Orchestrator,
    adapters: MessagingAdapter[],
    config?: Partial<AgentDaemonConfig>,
  ) {
    this.db = db
    this.agents = agents
    this.orchestrator = orchestrator
    this.adapters = adapters
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? 10_000,
      idleThresholdMs: config?.idleThresholdMs ?? 5 * 60 * 1000,
      channelId: config?.channelId,
    }
    this.logger = new Logger('daemon')
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastActivity = Date.now()
    this.logger.info(`Agent daemon started (${this.config.pollIntervalMs / 1000}s interval)`)

    // First tick immediately
    this.tick()
    this.interval = setInterval(() => this.tick(), this.config.pollIntervalMs)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.running = false
    this.logger.info('Agent daemon stopped')
  }

  /** Update the channel ID for broadcasts (set after Discord connects) */
  setChannelId(channelId: string): void {
    if (!this.config.channelId) {
      this.logger.info(`Channel ID set: ${channelId}`)
    }
    this.config.channelId = channelId
  }

  hasChannelId(): boolean {
    return !!this.config.channelId
  }

  // =========================================================================
  // Main tick
  // =========================================================================

  private async tick(): Promise<void> {
    try {
      await this.processTodos()
      await this.processCrons()
      await this.checkIdle()
    } catch (err: any) {
      this.logger.error(`Tick error: ${err.message}`)
    }
  }

  // =========================================================================
  // Todo dispatch
  // =========================================================================

  private async processTodos(): Promise<void> {
    const pending = await this.db.getTodos({ status: 'pending' })
    if (pending.length === 0) return

    this.logger.debug(`${pending.length} pending todo(s), agents loaded: [${Array.from(this.agents.keys()).join(', ')}]`)

    for (const todo of pending) {
      // Idempotent — skip if a job is already running for this todo
      if (await this.db.isJobRunning('todo', todo.id)) {
        this.logger.debug(`Skip "${todo.title}" (${todo.id}) — job already running`)
        continue
      }

      // Skip if dependencies not met
      if (!(await this.db.areDependenciesMet(todo.id))) {
        this.logger.debug(`Skip "${todo.title}" (${todo.id}) → ${todo.assignee} — deps not met`)
        continue
      }

      // Skip if agent not found
      if (!todo.assignee || !this.agents.has(todo.assignee)) {
        this.logger.warn(`Skip "${todo.title}" (${todo.id}) — agent "${todo.assignee}" not found`)
        continue
      }

      // Dispatch (fire and forget — runs in background)
      this.dispatchTodo(todo)
    }
  }

  private async dispatchTodo(todo: any): Promise<void> {
    const agent = this.agents.get(todo.assignee)!
    const agentName = todo.assignee

    // Create job record (prevents duplicate dispatch)
    const jobId = await this.db.addJob({ type: 'todo', ref: todo.id, assignee: agentName })

    this.logger.info(`Dispatching "${todo.title}" (${todo.id}) → ${agentName}`)
    this.lastActivity = Date.now()

    // Mark todo in_progress
    await this.db.updateTodo(todo.id, { status: 'in_progress' })
    await this.broadcast(`⚡ **${agentName}** starting: *${todo.title}*`)

    try {
      const result = await agent.workOnTodo(todo)

      // Done
      await this.db.updateTodo(todo.id, { status: 'done' })
      await this.db.addComment(todo.id, agentName, result, 'resolution')
      await this.db.completeJob(jobId, result.slice(0, 500))

      this.logger.success(`Completed "${todo.title}" (${todo.id}) by ${agentName}`)
      this.lastActivity = Date.now()

      const preview = result.length > 600 ? result.slice(0, 600) + '...' : result
      await this.broadcast(`✅ **${agentName}** completed: *${todo.title}*\n\n${preview}`, agentName)

      // Trigger orchestrator review
      await this.triggerOrchestratorReview(
        `Agent "${agentName}" completed todo "${todo.title}" (${todo.id}). Review results and decide what's next.`
      )

    } catch (err: any) {
      this.logger.error(`${agentName} failed on "${todo.title}": ${err.message}`)
      await this.db.updateTodo(todo.id, { status: 'blocked' })
      await this.db.addComment(todo.id, agentName, `Failed: ${err.message}`, 'escalation')
      await this.db.failJob(jobId, err.message)
      await this.broadcast(`❌ **${agentName}** failed: *${todo.title}* — escalated`)
    }
  }

  // =========================================================================
  // Cron dispatch
  // =========================================================================

  private async processCrons(): Promise<void> {
    const crons = await this.db.getCrons(true)
    if (crons.length === 0) return

    const now = Date.now()

    for (const cron of crons) {
      // Skip if already running
      if (await this.db.isJobRunning('cron', cron.id)) continue

      // Check if it's time to run
      if (cron.nextrun && new Date(cron.nextrun).getTime() > now) continue

      // Parse cron schedule and check if due
      if (!this.isCronDue(cron)) continue

      // Skip if agent not found
      if (!cron.assignee || !this.agents.has(cron.assignee)) continue

      this.dispatchCron(cron)
    }
  }

  private async dispatchCron(cron: any): Promise<void> {
    const agent = this.agents.get(cron.assignee)!
    const agentName = cron.assignee

    const jobId = await this.db.addJob({ type: 'cron', ref: cron.id, assignee: agentName })

    this.logger.info(`Cron "${cron.name}" (${cron.id}) → ${agentName}`)
    this.lastActivity = Date.now()

    try {
      const result = await agent.workOnTodo({
        id: cron.id,
        title: cron.name,
        description: cron.description,
      })

      // Calculate next run
      const nextrun = this.getNextRun(cron.schedule)
      await this.db.updateCronLastRan(cron.id, nextrun)
      await this.db.completeJob(jobId, result.slice(0, 500))

      this.logger.success(`Cron "${cron.name}" completed by ${agentName}`)

      const preview = result.length > 400 ? result.slice(0, 400) + '...' : result
      await this.broadcast(`🔄 **${agentName}** (cron: ${cron.name}):\n\n${preview}`, agentName)

    } catch (err: any) {
      this.logger.error(`Cron "${cron.name}" failed: ${err.message}`)
      await this.db.failJob(jobId, err.message)
    }
  }

  private isCronDue(cron: any): boolean {
    if (!cron.lastran) return true // Never ran — run immediately

    const lastRan = new Date(cron.lastran).getTime()
    const now = Date.now()

    // Simple interval parsing: supports "every Xm", "every Xh", "every Xd"
    // For more complex cron expressions, we'd use a library
    const schedule = cron.schedule.toLowerCase().trim()

    const match = schedule.match(/^every\s+(\d+)\s*(m|min|h|hour|d|day)s?$/i)
    if (match) {
      const value = parseInt(match[1])
      const unit = match[2][0] // m, h, or d
      let intervalMs: number
      switch (unit) {
        case 'm': intervalMs = value * 60 * 1000; break
        case 'h': intervalMs = value * 60 * 60 * 1000; break
        case 'd': intervalMs = value * 24 * 60 * 60 * 1000; break
        default: return false
      }
      return (now - lastRan) >= intervalMs
    }

    // "daily" = every 24h
    if (schedule === 'daily') {
      return (now - lastRan) >= 24 * 60 * 60 * 1000
    }

    // "hourly" = every 1h
    if (schedule === 'hourly') {
      return (now - lastRan) >= 60 * 60 * 1000
    }

    return false
  }

  private getNextRun(schedule: string): string {
    const now = Date.now()
    const s = schedule.toLowerCase().trim()

    const match = s.match(/^every\s+(\d+)\s*(m|min|h|hour|d|day)s?$/i)
    if (match) {
      const value = parseInt(match[1])
      const unit = match[2][0]
      let intervalMs: number
      switch (unit) {
        case 'm': intervalMs = value * 60 * 1000; break
        case 'h': intervalMs = value * 60 * 60 * 1000; break
        case 'd': intervalMs = value * 24 * 60 * 60 * 1000; break
        default: intervalMs = 60 * 60 * 1000
      }
      return new Date(now + intervalMs).toISOString()
    }

    if (s === 'daily') return new Date(now + 24 * 60 * 60 * 1000).toISOString()
    if (s === 'hourly') return new Date(now + 60 * 60 * 1000).toISOString()

    return new Date(now + 60 * 60 * 1000).toISOString() // Default: 1h
  }

  // =========================================================================
  // Idle check — poke orchestrator if nothing has happened for a while
  // =========================================================================

  private async checkIdle(): Promise<void> {
    const elapsed = Date.now() - this.lastActivity
    if (elapsed < this.config.idleThresholdMs) return

    // Check if there's actually work — pending todos or blocked items
    const pending = await this.db.getTodos({ status: 'pending' })
    const blocked = await this.db.getTodos({ status: 'blocked' })

    if (pending.length === 0 && blocked.length === 0) return // Genuinely idle, nothing to do

    this.lastActivity = Date.now() // Reset so we don't spam

    this.logger.info(`Idle for ${Math.round(elapsed / 1000)}s with ${pending.length} pending + ${blocked.length} blocked todos — poking orchestrator`)

    await this.triggerOrchestratorReview(
      `System has been idle for ${Math.round(elapsed / 60000)} minutes. There are ${pending.length} pending and ${blocked.length} blocked todos. Review and take action.`
    )
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async triggerOrchestratorReview(prompt: string): Promise<void> {
    if (!this.config.channelId) return

    // Don't double-trigger if orchestrator is already reviewing
    if (await this.db.isJobRunning('orchestrator', 'review')) return

    const jobId = await this.db.addJob({ type: 'orchestrator', ref: 'review', assignee: 'orchestrator' })

    try {
      const adapter = this.adapters[0]
      if (!adapter) return

      await this.orchestrator.handleMention(adapter.name, {
        id: crypto.randomUUID(),
        channelId: this.config.channelId,
        userId: 'system',
        content: prompt,
        mentions: [],
        isThread: false,
      })

      await this.db.completeJob(jobId, 'reviewed')
    } catch (err: any) {
      await this.db.failJob(jobId, err.message)
    }
  }

  private async broadcast(text: string, authorName?: string): Promise<void> {
    const adapter = this.adapters[0]
    if (!adapter || !this.config.channelId) return

    try {
      await adapter.sendMessage(
        { id: this.config.channelId, name: 'general', platform: adapter.name },
        { text, author: authorName ? { name: authorName } : undefined },
      )
    } catch (err: any) {
      this.logger.error(`Broadcast failed: ${err.message}`)
    }
  }
}
