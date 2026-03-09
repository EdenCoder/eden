#!/usr/bin/env npx tsx
// Remove an Eden agent
// Usage: npx tsx scripts/remove-agent.ts --name <name>

import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help || !values.name) {
  console.log(`Usage: npx tsx scripts/remove-agent.ts --name <name>`)
  process.exit(values.help ? 0 : 1)
}

const agentDir = join(resolve(process.cwd(), 'agents'), values.name)

try {
  await rm(agentDir, { recursive: true, force: true })
  console.log(JSON.stringify({ success: true, message: `Agent "${values.name}" removed.` }))
} catch (e: any) {
  console.error(JSON.stringify({ success: false, error: e.message }))
  process.exit(1)
}
