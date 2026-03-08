// @edenup/core — Daemon Lifecycle

import type { AgentConfig, DaemonState } from './types.js'
import type { MessagingAdapter } from '@edenup/messaging'

export interface DaemonContext {
  config: AgentConfig
  messaging: MessagingAdapter[]
  state: DaemonState
  lastHeartbeat: Date
  consecutiveErrors: number
}

export interface DaemonEvents {
  onStateChange: (from: DaemonState, to: DaemonState) => void | Promise<void>
  onHeartbeat: () => void | Promise<void>
  onError: (error: Error) => void | Promise<void>
  onTask: (task: unknown) => void | Promise<void>
}

export class Daemon {
  private ctx: DaemonContext
  private events: DaemonEvents
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: AgentConfig, messaging: MessagingAdapter[], events: DaemonEvents) {
    this.ctx = {
      config,
      messaging,
      state: 'booting',
      lastHeartbeat: new Date(),
      consecutiveErrors: 0,
    }
    this.events = events
  }

  get state(): DaemonState { return this.ctx.state }
  get agentName(): string { return this.ctx.config.name }
  get adapters(): readonly MessagingAdapter[] { return this.ctx.messaging }
  get config(): AgentConfig { return this.ctx.config }

  async boot(): Promise<void> {
    await this.transition('booting')
    await this.transition('ready')
    this.startHeartbeat()
  }

  async run(): Promise<void> { await this.transition('running') }
  async pause(_reason: string): Promise<void> { await this.transition('paused') }
  async resume(): Promise<void> { await this.transition('running') }

  async stop(): Promise<void> {
    await this.transition('stopping')
    this.stopHeartbeat()
    await this.transition('stopped')
  }

  private async transition(to: DaemonState): Promise<void> {
    const from = this.ctx.state
    this.ctx.state = to
    await this.events.onStateChange(from, to)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      this.ctx.lastHeartbeat = new Date()
      await this.events.onHeartbeat()
    }, this.ctx.config.daemon.heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}
