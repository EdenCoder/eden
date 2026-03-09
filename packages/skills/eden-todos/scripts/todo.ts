#!/usr/bin/env npx tsx
// Eden Todo Manager — CRUD for the todo system backed by LanceDB
// Usage: npx tsx scripts/todo.ts <command> [options]
//
// Commands:
//   create   Create a new todo
//   list     List todos (with optional filters)
//   update   Update a todo's status/assignee/priority
//   comment  Add a comment to a todo
//   close    Mark a todo as done with a resolution
//   delete   Delete a todo
//   details  Get full details of a todo including comments

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
    // Create with seed
    if (name === 'todos') {
      return db.createTable(name, [{
        id: 'init', title: '', description: '', assignee: '', status: 'done',
        priority: 'low', project: '', depends: '', creator: 'system',
        created: new Date().toISOString(), updated: new Date().toISOString(), completed: '',
      }])
    }
    if (name === 'comments') {
      return db.createTable(name, [{
        id: 'init', todo: '', author: '', content: '', type: 'system',
        ts: new Date().toISOString(),
      }])
    }
  }
  return db.openTable(name)
}

async function main() {
  const db = await getDb()

  switch (command) {
    case 'create': {
      const table = await getTable(db, 'todos')
      const id = crypto.randomUUID().slice(0, 8)
      await table.add([{
        id,
        title: args.title ?? '',
        description: args.description ?? '',
        assignee: args.assignee ?? '',
        status: 'pending',
        priority: args.priority ?? 'medium',
        project: args.project ?? '',
        depends: args['depends-on'] ?? '',
        creator: args.creator ?? 'orchestrator',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        completed: '',
      }])
      console.log(JSON.stringify({ success: true, id, message: `Todo "${args.title}" created (${id}).` }))
      break
    }

    case 'list': {
      const table = await getTable(db, 'todos')
      let filter = "id != 'init'"
      if (args.assignee) filter += ` AND assignee = '${args.assignee}'`
      if (args.status) filter += ` AND status = '${args.status}'`
      if (args.project) filter += ` AND project = '${args.project}'`
      const rows = await table.where(filter).execute()
      console.log(JSON.stringify({ todos: rows, count: rows.length }, null, 2))
      break
    }

    case 'update': {
      if (!args.id) { console.error('--id is required'); process.exit(1) }
      const table = await getTable(db, 'todos')
      const existing = await table.where(`id = '${args.id}'`).execute()
      if (existing.length === 0) { console.error(`Todo ${args.id} not found`); process.exit(1) }
      const record = existing[0]
      await table.delete(`id = '${args.id}'`)
      const updates: any = {}
      if (args.status) updates.status = args.status
      if (args.assignee) updates.assignee = args.assignee
      if (args.priority) updates.priority = args.priority
      await table.add([{
        ...record, ...updates,
        updated: new Date().toISOString(),
        completed: updates.status === 'done' ? new Date().toISOString() : record.completed,
      }])
      console.log(JSON.stringify({ success: true, message: `Todo ${args.id} updated.` }))
      break
    }

    case 'comment': {
      if (!args.id) { console.error('--id is required'); process.exit(1) }
      const table = await getTable(db, 'comments')
      const cid = crypto.randomUUID().slice(0, 8)
      await table.add([{
        id: cid, todo: args.id, author: args.author ?? 'unknown',
        content: args.content ?? '', type: args.type ?? 'comment',
        ts: new Date().toISOString(),
      }])
      // If escalation, also mark todo as blocked
      if (args.type === 'escalation') {
        const todos = await getTable(db, 'todos')
        const existing = await todos.where(`id = '${args.id}'`).execute()
        if (existing.length > 0) {
          const record = existing[0]
          await todos.delete(`id = '${args.id}'`)
          await todos.add([{ ...record, status: 'blocked', updated: new Date().toISOString() }])
        }
      }
      console.log(JSON.stringify({ success: true, commentId: cid }))
      break
    }

    case 'close': {
      if (!args.id) { console.error('--id is required'); process.exit(1) }
      const table = await getTable(db, 'todos')
      const existing = await table.where(`id = '${args.id}'`).execute()
      if (existing.length === 0) { console.error(`Todo ${args.id} not found`); process.exit(1) }
      const record = existing[0]
      await table.delete(`id = '${args.id}'`)
      await table.add([{ ...record, status: 'done', updated: new Date().toISOString(), completed: new Date().toISOString() }])
      if (args.resolution) {
        const comments = await getTable(db, 'comments')
        await comments.add([{
          id: crypto.randomUUID().slice(0, 8), todo: args.id,
          author: args.author ?? 'unknown', content: args.resolution,
          type: 'resolution', ts: new Date().toISOString(),
        }])
      }
      console.log(JSON.stringify({ success: true, message: `Todo ${args.id} closed.` }))
      break
    }

    case 'delete': {
      if (!args.id) { console.error('--id is required'); process.exit(1) }
      const table = await getTable(db, 'todos')
      await table.delete(`id = '${args.id}'`)
      console.log(JSON.stringify({ success: true, message: `Todo ${args.id} deleted.` }))
      break
    }

    case 'details': {
      if (!args.id) { console.error('--id is required'); process.exit(1) }
      const table = await getTable(db, 'todos')
      const rows = await table.where(`id = '${args.id}'`).execute()
      if (rows.length === 0) { console.error(`Todo ${args.id} not found`); process.exit(1) }
      const comments = await getTable(db, 'comments')
      let cmts: any[] = []
      try { cmts = await comments.where(`todo = '${args.id}'`).execute() } catch {}
      console.log(JSON.stringify({ todo: rows[0], comments: cmts }, null, 2))
      break
    }

    default:
      console.log(`Eden Todo Manager

Usage: npx tsx scripts/todo.ts <command> [options]

Commands:
  create    --title <t> --assignee <a> [--description <d>] [--priority low|medium|high|critical] [--project <p>] [--depends-on <id>]
  list      [--assignee <a>] [--status <s>] [--project <p>]
  update    --id <id> [--status <s>] [--assignee <a>] [--priority <p>]
  comment   --id <id> --author <a> --content <c> [--type comment|escalation]
  close     --id <id> [--resolution <r>] [--author <a>]
  delete    --id <id>
  details   --id <id>`)
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
