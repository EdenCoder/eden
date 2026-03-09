#!/usr/bin/env npx tsx
// List all Eden agents from the agents/ directory
// Usage: npx tsx scripts/list-agents.ts

import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const agentsPath = resolve(process.cwd(), 'agents')

async function main() {
  let entries
  try {
    entries = await readdir(agentsPath, { withFileTypes: true })
  } catch {
    console.log(JSON.stringify({ agents: [], message: 'No agents/ directory found.' }))
    return
  }

  const agents = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(agentsPath, entry.name)

    try {
      const configPath = join(dir, 'agent.config.ts')
      const configContent = await readFile(configPath, 'utf-8')

      // Extract key fields from config via regex (avoids needing to import/eval)
      const name = entry.name
      const description = configContent.match(/description:\s*['"](.+?)['"]/)?.[1] ?? ''
      const personality = configContent.match(/personality:\s*['"](.+?)['"]/)?.[1] ?? ''
      const model = configContent.match(/default:\s*['"](.+?)['"]/)?.[1] ?? ''
      const budget = configContent.match(/maxPerDay:\s*([\d.]+)/)?.[1] ?? '0'

      let persona = ''
      try {
        persona = (await readFile(join(dir, 'AGENT.md'), 'utf-8')).slice(0, 200)
      } catch {}

      agents.push({ name, description, personality, model, budgetPerDay: parseFloat(budget), persona })
    } catch {
      // Skip dirs without valid config
    }
  }

  console.log(JSON.stringify({ agents, message: `${agents.length} agent(s) found.` }, null, 2))
}

main().catch(e => { console.error(e.message); process.exit(1) })
