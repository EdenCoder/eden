// @edenup/core — BudgetTracker

import type {
  AgentBudgetConfig,
  MetaBudgetConfig,
} from './types.js'

export interface BudgetSnapshot {
  agentName: string
  todayUsd: number
  lifetimeUsd: number
  taskUsd: number
  limits: AgentBudgetConfig
  status: 'ok' | 'warning' | 'exhausted'
}

export interface BudgetRecord {
  agentName: string
  taskId: string
  costUsd: number
  model: string
  inputTokens: number
  outputTokens: number
  timestamp: Date
}

/**
 * Tracks per-agent and meta-level (org-wide) budget usage.
 * Stores cost records in the database and enforces limits
 * defined in AgentBudgetConfig and MetaBudgetConfig.
 */
export class BudgetTracker {
  private agentUsage: Map<string, { today: number; lifetime: number; task: number }> = new Map()
  private metaUsage: { today: number; lifetime: number } = { today: 0, lifetime: 0 }

  constructor() {
    // TODO: Accept Database instance for persistent storage
    // TODO: Load historical usage from db on construction
  }

  /**
   * Check whether an agent can spend the given amount without exceeding limits.
   * Returns the current status and whether the spend is allowed.
   */
  check(
    agentName: string,
    proposedCostUsd: number,
    agentBudget: AgentBudgetConfig,
    metaBudget: MetaBudgetConfig,
  ): { allowed: boolean; reason?: string; snapshot: BudgetSnapshot } {
    const usage = this.getOrCreateUsage(agentName)

    // Check meta-level limits first
    if (this.metaUsage.today + proposedCostUsd > metaBudget.maxPerDay) {
      return {
        allowed: false,
        reason: `Org daily budget exceeded: $${this.metaUsage.today.toFixed(4)} + $${proposedCostUsd.toFixed(4)} > $${metaBudget.maxPerDay}`,
        snapshot: this.snapshot(agentName, agentBudget),
      }
    }
    if (this.metaUsage.lifetime + proposedCostUsd > metaBudget.maxLifetime) {
      return {
        allowed: false,
        reason: `Org lifetime budget exceeded`,
        snapshot: this.snapshot(agentName, agentBudget),
      }
    }

    // Check agent-level limits
    if (usage.today + proposedCostUsd > agentBudget.maxPerDay) {
      return {
        allowed: false,
        reason: `Agent daily budget exceeded for ${agentName}`,
        snapshot: this.snapshot(agentName, agentBudget),
      }
    }
    if (usage.task + proposedCostUsd > agentBudget.maxPerTask) {
      return {
        allowed: false,
        reason: `Agent per-task budget exceeded for ${agentName}`,
        snapshot: this.snapshot(agentName, agentBudget),
      }
    }
    if (usage.lifetime + proposedCostUsd > agentBudget.maxLifetime) {
      return {
        allowed: false,
        reason: `Agent lifetime budget exceeded for ${agentName}`,
        snapshot: this.snapshot(agentName, agentBudget),
      }
    }

    return { allowed: true, snapshot: this.snapshot(agentName, agentBudget) }
  }

  /**
   * Record a completed LLM call's cost against the agent's budget.
   */
  record(agentName: string, record: Omit<BudgetRecord, 'agentName'>): void {
    const usage = this.getOrCreateUsage(agentName)
    usage.today += record.costUsd
    usage.task += record.costUsd
    usage.lifetime += record.costUsd
    this.metaUsage.today += record.costUsd
    this.metaUsage.lifetime += record.costUsd

    // TODO: Persist BudgetRecord to database (LanceDB table: budget_records)
    // TODO: Emit budget warning events when approaching warnAt threshold
  }

  /**
   * Reset the per-task accumulator for an agent (called when a new task begins).
   */
  resetTask(agentName: string): void {
    const usage = this.getOrCreateUsage(agentName)
    usage.task = 0
  }

  /**
   * Get a point-in-time snapshot of an agent's budget status.
   */
  snapshot(agentName: string, agentBudget: AgentBudgetConfig): BudgetSnapshot {
    const usage = this.getOrCreateUsage(agentName)

    let status: BudgetSnapshot['status'] = 'ok'
    const dayRatio = usage.today / agentBudget.maxPerDay
    const lifetimeRatio = usage.lifetime / agentBudget.maxLifetime
    const maxRatio = Math.max(dayRatio, lifetimeRatio)

    if (maxRatio >= 1.0) {
      status = 'exhausted'
    } else if (maxRatio >= agentBudget.warnAt) {
      status = 'warning'
    }

    return {
      agentName,
      todayUsd: usage.today,
      lifetimeUsd: usage.lifetime,
      taskUsd: usage.task,
      limits: agentBudget,
      status,
    }
  }

  private getOrCreateUsage(agentName: string) {
    let usage = this.agentUsage.get(agentName)
    if (!usage) {
      usage = { today: 0, lifetime: 0, task: 0 }
      this.agentUsage.set(agentName, usage)
    }
    return usage
  }
}
