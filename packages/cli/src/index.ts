#!/usr/bin/env node
// ============================================================================
// @edenup/cli — CLI tool
// ============================================================================
// npx eden init    — Scaffold a new Eden project
// npx eden start   — Boot Eden from eden.config.ts (compose file)
// npx eden status  — Print agent health/budget summary

import { resolve } from 'node:path'

const command = process.argv[2]

switch (command) {
  case 'init':
    await init()
    break
  case 'start':
    await start()
    break
  case 'status':
    await status()
    break
  default:
    console.log(`
Eden — Multi-Agent Orchestration Framework

Usage:
  npx eden init              Scaffold a new Eden project
  npx eden start             Boot Eden from eden.config.ts
  npx eden start --config X  Boot Eden from a custom compose file
  npx eden status            Print agent health/budget summary

Docs: https://github.com/edencoder/eden
    `.trim())
}

async function init(): Promise<void> {
  // TODO: Scaffold eden.config.ts, .env.example, .gitignore, skills/, agents/
  console.log('Scaffolding new Eden project...')
  console.log('TODO: Not implemented yet')
}

async function start(): Promise<void> {
  const configPath = resolve(process.cwd(), getConfigPath())
  console.log(`Loading compose file: ${configPath}`)

  // The compose file exports an Eden instance (already configured with adapters)
  let mod
  try {
    mod = await import(configPath)
  } catch (err) {
    console.error(`Failed to load config from ${configPath}`)
    console.error(err)
    process.exit(1)
  }

  const eden = mod.default || mod.eden

  if (!eden || typeof eden.start !== 'function') {
    console.error('Error: Compose file must export an Eden instance as default export')
    console.error('Example: export default new Eden({ config, messaging: [...] })')
    process.exit(1)
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...')
    await eden.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await eden.start()
}

async function status(): Promise<void> {
  // TODO: Connect to running Eden instance, print health/budget
  console.log('TODO: Not implemented yet')
}

function getConfigPath(): string {
  const flagIndex = process.argv.indexOf('--config')
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1]
  }
  return './eden.config.js' // Typically compiled js in Node, but users might use tsx
}
