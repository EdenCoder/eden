#!/usr/bin/env npx tsx
// Create a new Eden agent
// Usage: npx tsx scripts/create-agent.ts --name <name> --description <desc> --personality <pers> [--model <model>] [--budget <n>]

import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    description: { type: 'string' },
    personality: { type: 'string' },
    model: { type: 'string', default: 'anthropic/claude-haiku-4.5' },
    budget: { type: 'string', default: '5' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help || !values.name || !values.description || !values.personality) {
  console.log(`Usage: npx tsx scripts/create-agent.ts --name <name> --description <desc> --personality <pers>

Options:
  --name          Agent name (lowercase, no spaces)
  --description   One-line description of the agent's role
  --personality   2-3 personality traits
  --model         OpenRouter model ID (default: anthropic/claude-haiku-4.5)
  --budget        Daily budget in USD (default: 5)`)
  process.exit(values.help ? 0 : 1)
}

const agentsPath = resolve(process.cwd(), 'agents')
const agentDir = join(agentsPath, values.name)

const config = `import type { AgentConfig } from '@edenup/core'

export default {
  name: '${values.name}',
  description: '${values.description}',
  personality: '${values.personality}',
  messaging: {
    channelName: '${values.name}',
    verboseChannelName: 'verbose-${values.name}',
    threadPerTask: true,
    updateMode: 'edit',
    statusEmoji: '🤖',
    throttleMs: 3000,
    verboseCollapsible: true,
  },
  router: {
    default: '${values.model}',
    routes: {},
  },
  budget: {
    maxPerDay: ${parseFloat(values.budget!)},
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
  tools: { builtin: [], mcp: [] },
  skills: { local: [], global: [] },
} satisfies AgentConfig
`

const persona = `You are ${values.name}. ${values.description}

${values.personality}

When asked about something outside your expertise, say so honestly and suggest who might be better suited.
`

await mkdir(agentDir, { recursive: true })
await writeFile(join(agentDir, 'agent.config.ts'), config)
await writeFile(join(agentDir, 'AGENT.md'), persona)

console.log(JSON.stringify({
  success: true,
  message: `Agent "${values.name}" created at agents/${values.name}/`,
  path: agentDir,
}))
