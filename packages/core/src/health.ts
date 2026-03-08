// @edenup/core — HealthMonitor

import type { DaemonState } from './types.js'

export interface AgentHealth {
  agentName: string
  state: DaemonState
  lastHeartbeat: Date
  consecutiveErrors: number
  isHealthy: boolean
  uptimeMs: number
}

export interface HealthReport {
  timestamp: Date
  agents: AgentHealth[]
  totalAgents: number
  healthyAgents: number
  unhealthyAgents: number
}

const HEARTBEAT_TIMEOUT_MS = 60_000 // Consider unhealthy if no heartbeat for 60s

/**
 * Monitors the health of all running agent daemons.
 * Tracks heartbeats, error counts, and daemon states.
 * Used by the orchestrator and control panel to display agent status.
 */
export class HealthMonitor {
  private agents: Map<string, {
    state: DaemonState
    lastHeartbeat: Date
    consecutiveErrors: number
    bootedAt: Date
  }> = new Map()

  constructor() {
    // TODO: Accept Database for persisting health history
    // TODO: Accept MessagingAdapter[] for posting health alerts
    // TODO: Accept Logger for structured health logging
  }

  /**
   * Record a heartbeat from an agent daemon.
   * Resets the consecutive error count and updates the timestamp.
   */
  reportHeartbeat(agentName: string, state: DaemonState): void {
    const existing = this.agents.get(agentName)

    if (existing) {
      existing.state = state
      existing.lastHeartbeat = new Date()
      // Heartbeat implies the agent is alive; reset errors if state is healthy
      if (state === 'running' || state === 'ready' || state === 'waiting') {
        existing.consecutiveErrors = 0
      }
    } else {
      this.agents.set(agentName, {
        state,
        lastHeartbeat: new Date(),
        consecutiveErrors: 0,
        bootedAt: new Date(),
      })
    }
  }

  /**
   * Report an error for an agent. Increments the consecutive error count.
   * If the error count exceeds the agent's maxConsecutiveErrors,
   * the orchestrator should take corrective action (restart, pause, etc.).
   */
  reportError(agentName: string, _error: Error): number {
    const agent = this.agents.get(agentName)
    if (!agent) {
      // Register the agent in error state
      this.agents.set(agentName, {
        state: 'error',
        lastHeartbeat: new Date(),
        consecutiveErrors: 1,
        bootedAt: new Date(),
      })
      return 1
    }

    agent.state = 'error'
    agent.consecutiveErrors++

    // TODO: Persist error to database for post-mortem analysis
    // TODO: If consecutiveErrors > threshold, post alert to control channel

    return agent.consecutiveErrors
  }

  /**
   * Check the health of a single agent.
   */
  check(agentName: string): AgentHealth | null {
    const agent = this.agents.get(agentName)
    if (!agent) return null

    const now = new Date()
    const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime()
    const isTimedOut = timeSinceHeartbeat > HEARTBEAT_TIMEOUT_MS
    const isErrorState = agent.state === 'error' || agent.state === 'stopped'
    const isHealthy = !isTimedOut && !isErrorState

    return {
      agentName,
      state: agent.state,
      lastHeartbeat: agent.lastHeartbeat,
      consecutiveErrors: agent.consecutiveErrors,
      isHealthy,
      uptimeMs: now.getTime() - agent.bootedAt.getTime(),
    }
  }

  /**
   * Check the health of all registered agents and produce a summary report.
   */
  checkAll(): HealthReport {
    const agents: AgentHealth[] = []

    for (const agentName of this.agents.keys()) {
      const health = this.check(agentName)
      if (health) agents.push(health)
    }

    const healthyAgents = agents.filter((a) => a.isHealthy).length

    return {
      timestamp: new Date(),
      agents,
      totalAgents: agents.length,
      healthyAgents,
      unhealthyAgents: agents.length - healthyAgents,
    }
  }

  /**
   * Remove an agent from monitoring (e.g., after teardown).
   */
  unregister(agentName: string): void {
    this.agents.delete(agentName)
  }

  /**
   * Update an agent's state without a full heartbeat
   * (e.g., when transitioning to 'paused' or 'stopping').
   */
  setState(agentName: string, state: DaemonState): void {
    const agent = this.agents.get(agentName)
    if (agent) {
      agent.state = state
    }
  }
}
