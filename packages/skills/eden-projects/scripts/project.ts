#!/usr/bin/env npx tsx
// Eden Project Manager
// Usage: npx tsx scripts/project.ts <command> [options]

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const PROJECTS_PATH = resolve(process.cwd(), 'projects')
const command = process.argv[2]
const args = parseFlags(process.argv.slice(3))

async function main() {
  switch (command) {
    case 'create': {
      if (!args.name) { console.error('--name is required'); process.exit(1) }
      const dir = join(PROJECTS_PATH, args.name)
      await mkdir(dir, { recursive: true })
      const desc = args.description ?? ''
      const type = args.type ?? 'app'
      await writeFile(join(dir, 'README.md'), `# ${args.name}\n\n${desc}\n\nType: ${type}\nCreated: ${new Date().toISOString()}\n`)
      console.log(JSON.stringify({ success: true, path: dir, message: `Project "${args.name}" created at projects/${args.name}/` }))
      break
    }

    case 'list': {
      await mkdir(PROJECTS_PATH, { recursive: true })
      const entries = await readdir(PROJECTS_PATH, { withFileTypes: true })
      const projects = entries.filter(e => e.isDirectory()).map(e => e.name)
      console.log(JSON.stringify({ projects, count: projects.length }))
      break
    }

    default:
      console.log(`Eden Project Manager

Usage: npx tsx scripts/project.ts <command> [options]

Commands:
  create  --name <n> [--description <d>] [--type app|website|service|library]
  list`)
  }
}

function parseFlags(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      result[key] = val
    }
  }
  return result
}

main().catch(e => { console.error(e.message); process.exit(1) })
