// @edenup/core — ApprovalManager

import type { AgentApprovalConfig } from './types.js'

export interface ApprovalRequest {
  id: string
  agentName: string
  action: string
  description: string
  estimatedCostUsd: number
  status: 'pending' | 'approved' | 'denied' | 'timeout'
  requestedAt: Date
  resolvedAt?: Date
  resolvedBy?: string
}

export type ApprovalResult =
  | { approved: true; approvedBy: string }
  | { approved: false; reason: string }

/**
 * Manages human-in-the-loop approval gates for agent actions.
 * Posts approval requests to the messaging adapter and waits for
 * reactions or timeouts, respecting the agent's approval config.
 */
export class ApprovalManager {
  private pending: Map<string, ApprovalRequest> = new Map()
  private requestCounter = 0

  constructor() {
    // TODO: Accept MessagingAdapter[] for posting approval requests to channels
    // TODO: Accept Database for persisting approval history
  }

  /**
   * Request human approval for an agent action.
   *
   * Checks the agent's approval config for auto-approve rules first:
   *   - If the action is in `alwaysApprove`, returns immediately approved.
   *   - If cost is below `approveAbove.costUsd`, returns immediately approved.
   *   - Otherwise, posts to the control/human channel and waits for a reaction.
   *
   * Returns the approval result after resolution or timeout.
   */
  async requestApproval(
    agentName: string,
    action: string,
    description: string,
    estimatedCostUsd: number,
    config: AgentApprovalConfig,
  ): Promise<ApprovalResult> {
    // Auto-approve: action is in the always-approve list
    if (config.alwaysApprove.includes(action)) {
      return { approved: true, approvedBy: 'auto:always_approve' }
    }

    // Auto-approve: cost is below the threshold
    if (estimatedCostUsd < config.approveAbove.costUsd) {
      return { approved: true, approvedBy: 'auto:below_threshold' }
    }

    // Create the approval request
    const id = `approval-${++this.requestCounter}-${Date.now()}`
    const request: ApprovalRequest = {
      id,
      agentName,
      action,
      description,
      estimatedCostUsd,
      status: 'pending',
      requestedAt: new Date(),
    }
    this.pending.set(id, request)

    // TODO: Post approval request embed to the human/control channel
    //   - Include action, description, estimated cost, agent name
    //   - Add checkmark / X reactions for approve/deny
    //   - Subscribe to reactions using messaging adapter's onReaction()

    // TODO: Implement timeout using config.timeoutMs
    //   - On timeout, apply config.onTimeout ('skip' | 'escalate' | 'proceed')
    //   - 'skip': return denied with reason 'timeout'
    //   - 'escalate': notify owner, return denied
    //   - 'proceed': return approved with approvedBy 'auto:timeout_proceed'

    // Placeholder: wait for timeout then apply onTimeout policy
    return new Promise<ApprovalResult>((resolve) => {
      setTimeout(() => {
        request.status = 'timeout'
        request.resolvedAt = new Date()
        this.pending.delete(id)

        switch (config.onTimeout) {
          case 'proceed':
            resolve({ approved: true, approvedBy: 'auto:timeout_proceed' })
            break
          case 'escalate':
            // TODO: Send escalation notification to owner
            resolve({ approved: false, reason: `Approval timed out after ${config.timeoutMs}ms — escalated to owner` })
            break
          case 'skip':
          default:
            resolve({ approved: false, reason: `Approval timed out after ${config.timeoutMs}ms` })
            break
        }
      }, config.timeoutMs)
    })
  }

  /**
   * Resolve a pending approval externally (e.g., from a reaction handler).
   */
  resolve(id: string, approved: boolean, resolvedBy: string): void {
    const request = this.pending.get(id)
    if (!request) return

    request.status = approved ? 'approved' : 'denied'
    request.resolvedAt = new Date()
    request.resolvedBy = resolvedBy
    this.pending.delete(id)

    // TODO: Persist resolution to database
    // TODO: Resume the waiting promise (requires replacing setTimeout with event-driven approach)
  }

  /**
   * Get all currently pending approval requests.
   */
  getPending(): ApprovalRequest[] {
    return Array.from(this.pending.values())
  }
}
