// ============================================================================
// @edenup/core — Orchestrator Tools: Manage Agents
// ============================================================================

import { tool } from 'ai'
import { z } from 'zod'
import { writeFile, mkdir, readdir, rm, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { AgentConfig, EdenConfig } from '../../types.js'
import type { MessagingAdapter } from '@edenup/messaging'
import { WorkerAgent } from '../../agent.js'

export function createManageAgentTools(
  edenConfig: EdenConfig,
  adapters: MessagingAdapter[],
  agents: Map<string, WorkerAgent>,
  onAgentBooted: (name: string, agent: WorkerAgent) => void,
) {
  const agentsPath = resolve(process.cwd(), edenConfig.paths.agents)

  return {
    createAgent: tool({
      description: 'Create a new sub-agent with a name, personality, model, and budget. The agent will immediately boot and start listening for @mentions.',
      parameters: z.object({
        name: z.string().regex(/^[a-z][a-z0-9-]*$/).describe('Lowercase name, no spaces. Becomes the @mention name.'),
        description: z.string().describe('One sentence about what this agent does.'),
        personality: z.string().describe('2-3 personality traits that shape how the agent communicates.'),
        model: z.string().default('anthropic/claude-haiku-4.5').describe('OpenRouter model string.'),
        budgetPerDay: z.number().default(3).describe('Daily spend cap in USD.'),
      }),
      execute: async ({ name, description, personality, model, budgetPerDay }) => {
        if (agents.has(name)) {
          return { success: false, error: `Agent "${name}" already exists.` }
        }

        const agentDir = join(agentsPath, name)

        const agentConfig: AgentConfig = {
          name,
          description,
          personality,
          messaging: {
            channelName: name,
            verboseChannelName: `verbose-${name}`,
            threadPerTask: true,
            updateMode: 'edit',
            statusEmoji: '🤖',
            throttleMs: 3000,
            verboseCollapsible: true,
          },
          router: {
            default: model,
            routes: {},
          },
          budget: {
            maxPerDay: budgetPerDay,
            maxPerTask: 1.0,
            maxLifetime: 100.0,
            warnAt: 0.8,
            onExhausted: 'pause',
          },
          daemon: {
            mode: 'event',
            heartbeatIntervalMs: 30_000,
            maxConsecutiveErrors: 5,
            restartDelayMs: 10_000,
          },
          approval: {
            alwaysApprove: [],
            approveAbove: { costUsd: 0.5 },
            timeoutMs: 30 * 60 * 1000,
            onTimeout: 'skip',
          },
          tools: {
            builtin: [],
            mcp: [],
          },
          skills: {
            local: [],
            global: [],
          },
        }

        // Write config to disk
        await mkdir(agentDir, { recursive: true })
        
        const configContent = `import type { AgentConfig } from '@edenup/core'

export default ${JSON.stringify(agentConfig, null, 2)} satisfies AgentConfig
`
        await writeFile(join(agentDir, 'agent.config.ts'), configContent)

        // Boot the agent immediately
        const agent = new WorkerAgent(edenConfig, agentConfig, adapters)
        await agent.boot()
        agents.set(name, agent)
        onAgentBooted(name, agent)

        return { success: true, message: `Agent "${name}" created and booted. Users can now @${name} in Discord.` }
      },
    }),

    listAgents: tool({
      description: 'List all currently running sub-agents with their name, description, personality, model, and budget.',
      parameters: z.object({}),
      execute: async () => {
        if (agents.size === 0) {
          return { agents: [], message: 'No sub-agents running.' }
        }

        const list: Array<{
          name: string
          description: string
          personality: string
          model: string
          budgetPerDay: number
        }> = []

        // Read configs from disk to get full info
        try {
          const entries = await readdir(agentsPath, { withFileTypes: true })
          for (const entry of entries) {
            if (!entry.isDirectory()) continue
            try {
              const configPath = join(agentsPath, entry.name, 'agent.config.ts')
              const mod = await import(configPath)
              const cfg = mod.default as AgentConfig
              list.push({
                name: cfg.name,
                description: cfg.description,
                personality: cfg.personality,
                model: cfg.router.default,
                budgetPerDay: cfg.budget.maxPerDay,
              })
            } catch {
              // Skip broken configs
            }
          }
        } catch {
          // agents dir doesn't exist
        }

        return { agents: list, message: `${list.length} agent(s) running.` }
      },
    }),

    updateAgent: tool({
      description: 'Update an existing agent\'s personality, description, model, or budget. The agent will be restarted with the new config.',
      parameters: z.object({
        name: z.string().describe('Name of the agent to update.'),
        description: z.string().optional().describe('New description.'),
        personality: z.string().optional().describe('New personality traits.'),
        model: z.string().optional().describe('New OpenRouter model string.'),
        budgetPerDay: z.number().optional().describe('New daily budget in USD.'),
      }),
      execute: async ({ name, description, personality, model, budgetPerDay }) => {
        const agentDir = join(agentsPath, name)
        const configPath = join(agentDir, 'agent.config.ts')

        let mod
        try {
          mod = await import(configPath + `?t=${Date.now()}`)
        } catch {
          return { success: false, error: `Agent "${name}" not found.` }
        }

        const existing = mod.default as AgentConfig
        const updated: AgentConfig = {
          ...existing,
          description: description ?? existing.description,
          personality: personality ?? existing.personality,
          router: {
            ...existing.router,
            default: model ?? existing.router.default,
          },
          budget: {
            ...existing.budget,
            maxPerDay: budgetPerDay ?? existing.budget.maxPerDay,
          },
        }

        // Write updated config
        const configContent = `import type { AgentConfig } from '@edenup/core'

export default ${JSON.stringify(updated, null, 2)} satisfies AgentConfig
`
        await writeFile(configPath, configContent)

        // Restart the agent
        const oldAgent = agents.get(name)
        if (oldAgent) {
          await oldAgent.stop()
          agents.delete(name)
        }

        const newAgent = new WorkerAgent(edenConfig, updated, adapters)
        await newAgent.boot()
        agents.set(name, newAgent)
        onAgentBooted(name, newAgent)

        return { success: true, message: `Agent "${name}" updated and restarted.` }
      },
    }),

    removeAgent: tool({
      description: 'Stop and remove an agent. Deletes its config folder.',
      parameters: z.object({
        name: z.string().describe('Name of the agent to remove.'),
      }),
      execute: async ({ name }) => {
        const agent = agents.get(name)
        if (agent) {
          await agent.stop()
          agents.delete(name)
        }

        const agentDir = join(agentsPath, name)
        try {
          await rm(agentDir, { recursive: true, force: true })
        } catch {
          // Directory might not exist
        }

        return { success: true, message: `Agent "${name}" removed.` }
      },
    }),
  }
}
