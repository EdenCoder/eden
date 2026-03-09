#!/usr/bin/env npx tsx
// Eden Cron Manager
// Usage: npx tsx scripts/cron.ts <command> [options]

import { connect } from 'vectordb'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'

const DB_PATH = resolve(process.cwd(), '.eden/lance')

const command = process.argv[2]
const args = parseFlags(process.argv.slice(3))

async function getDb() {
  await mkdir(DB_PATH, { recursive: true })
  return connect(DB_PATH)
}

async function getTable(db: any, name: string) {
  const tables = await db.tableNames()
  if (!tables.includes(name)) {
    return db.createTable(name, [{
      id: 'init', name: '', schedule: '', assignee: '',
      description: '', enabled: 'false', lastran: '', nextrun: '',
      created: new Date().toISOString(),
    }])
  }
  return db.openTable(name)
}

async function main() {
  const db = await getDb()

  switch (command) {
    case 'add': {
      if (!args.name || !args.schedule || !args.assignee) {
        console.error('Required: --name, --schedule, --assignee')
        process.exit(1)
      }
      const table = await getTable(db, 'crons')
      const id = crypto.randomUUID().slice(0, 8)
      await table.add([{
        id, name: args.name, schedule: args.schedule,
        assignee: args.assignee, description: args.description ?? '',
        enabled: 'true', lastran: '', nextrun: '',
        created: new Date().toISOString(),
      }])
      console.log(JSON.stringify({ success: true, id, message: `Cron "${args.name}" created (${id}).` }))
      break
    }

    case 'list': {
      const table = await getTable(db, 'crons')
      const rows = await table.where("id != 'init'").execute()
      console.log(JSON.stringify({ crons: rows, count: rows.length }, null, 2))
      break
    }

    case 'remove': {
      if (!args.id) { console.error('--id is required'); process.exit(1) }
      const table = await getTable(db, 'crons')
      await table.delete(`id = '${args.id}'`)
      console.log(JSON.stringify({ success: true, message: `Cron ${args.id} removed.` }))
      break
    }

    default:
      console.log(`Eden Cron Manager

Usage: npx tsx scripts/cron.ts <command> [options]

Commands:
  add     --name <n> --schedule <s> --assignee <a> [--description <d>]
  list
  remove  --id <id>

Schedule formats:
  daily, hourly, every 30m, every 2h, every 3d`)
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
