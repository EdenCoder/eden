// @edenup/core — ToolManager

import type {
  ToolRequest,
  ToolResolution,
  AgentToolsConfig,
} from './types.js'

/**
 * Manages tool discovery, request, and provisioning for agents.
 *
 * When an agent needs a tool it doesn't have, it submits a ToolRequest.
 * The ToolManager (via the orchestrator) researches available options,
 * resolves the best source, and provisions the tool into the agent's
 * MCP configuration.
 */
export class ToolManager {
  private requests: Map<string, ToolRequest> = new Map()
  private requestCounter = 0

  constructor() {
    // TODO: Accept Database for persisting tool requests and resolutions
    // TODO: Accept MessagingAdapter[] for posting research/approval messages
    // TODO: Accept an MCP registry client for first-party MCP lookups
  }

  /**
   * Submit a tool request from an agent. Creates a pending request
   * that the orchestrator will research and resolve.
   */
  async requestTool(
    agentName: string,
    toolName: string,
    reason: string,
  ): Promise<ToolRequest> {
    const id = `tool-req-${++this.requestCounter}-${Date.now()}`

    const request: ToolRequest = {
      id,
      agentName,
      toolName,
      reason,
      status: 'pending',
    }

    this.requests.set(id, request)

    // TODO: Post tool request to the orchestrator's verbose channel
    //   "Agent {agentName} is requesting tool '{toolName}': {reason}"
    // TODO: Trigger the orchestrator's tool-provisioning skill

    return request
  }

  /**
   * Resolve a tool request with a discovered resolution.
   * Called by the orchestrator after researching available options.
   *
   * Resolution types:
   *   - 'first-party-mcp': Found in the public MCP registry
   *   - 'self-built-mcp': Orchestrator will build a custom MCP server
   *   - 'builtin-tool': Already available as a builtin AI SDK tool
   */
  async resolve(requestId: string, resolution: ToolResolution): Promise<ToolRequest> {
    const request = this.requests.get(requestId)
    if (!request) {
      throw new Error(`Tool request ${requestId} not found`)
    }

    request.resolution = resolution
    request.status = resolution.requiresHumanApproval ? 'pending' : 'approved'

    // TODO: If requiresHumanApproval, post approval request via ApprovalManager
    // TODO: If requiresSecrets, prompt for secrets via human channel
    // TODO: Persist resolution to database

    return request
  }

  /**
   * Provision a resolved and approved tool into an agent's tool configuration.
   * Updates the agent's MCP config to include the new tool server.
   */
  async provision(
    requestId: string,
    agentTools: AgentToolsConfig,
  ): Promise<AgentToolsConfig> {
    const request = this.requests.get(requestId)
    if (!request) {
      throw new Error(`Tool request ${requestId} not found`)
    }
    if (request.status !== 'approved') {
      throw new Error(`Tool request ${requestId} is not approved (status: ${request.status})`)
    }
    if (!request.resolution) {
      throw new Error(`Tool request ${requestId} has no resolution`)
    }

    const resolution = request.resolution
    const updatedTools = { ...agentTools }

    switch (resolution.type) {
      case 'first-party-mcp':
      case 'self-built-mcp': {
        if (!resolution.mcpConfig) {
          throw new Error(`MCP resolution for ${requestId} is missing mcpConfig`)
        }
        // Add the MCP server to the agent's tool config
        updatedTools.mcp = [
          ...updatedTools.mcp,
          resolution.mcpConfig,
        ]
        break
      }
      case 'builtin-tool': {
        // Add to the agent's builtin tools list
        updatedTools.builtin = [
          ...updatedTools.builtin,
          request.toolName,
        ]
        break
      }
    }

    // TODO: Persist updated agent config to disk
    // TODO: Hot-reload the agent's tool loop with the new tools
    // TODO: Post confirmation to verbose channel

    return updatedTools
  }

  /**
   * Get all tool requests, optionally filtered by status or agent.
   */
  getRequests(filter?: {
    agentName?: string
    status?: ToolRequest['status']
  }): ToolRequest[] {
    let results = Array.from(this.requests.values())

    if (filter?.agentName) {
      results = results.filter((r) => r.agentName === filter.agentName)
    }
    if (filter?.status) {
      results = results.filter((r) => r.status === filter.status)
    }

    return results
  }

  /**
   * Deny a tool request with a reason.
   */
  deny(requestId: string, _reason: string): void {
    const request = this.requests.get(requestId)
    if (!request) return
    request.status = 'denied'

    // TODO: Notify the requesting agent via messaging adapter
  }
}
