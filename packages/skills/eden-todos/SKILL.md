---
name: eden-todos
description: Create, assign, track, and manage todos with dependencies and comments. Use when breaking goals into tasks, assigning work to agents, tracking progress, or handling escalations from blocked agents.
---

# Eden Todos

Todos are the unit of work in Eden. Every goal gets broken into todos, every todo gets assigned to an agent. Todos live in the `.eden/lance` database.

## Available scripts

- **`scripts/todo.ts`** — Full todo management (create, list, update, comment, close, delete)

## Creating a todo

```bash
npx tsx .agents/skills/eden-todos/scripts/todo.ts create \
  --title "Design landing page" \
  --description "Create a modern landing page for the app" \
  --assignee nova \
  --priority high \
  --project my-app
```

## Listing todos

```bash
npx tsx .agents/skills/eden-todos/scripts/todo.ts list
npx tsx .agents/skills/eden-todos/scripts/todo.ts list --assignee nova
npx tsx .agents/skills/eden-todos/scripts/todo.ts list --status pending
npx tsx .agents/skills/eden-todos/scripts/todo.ts list --project my-app
```

## Updating a todo

```bash
npx tsx .agents/skills/eden-todos/scripts/todo.ts update --id abc123 --status in_progress
npx tsx .agents/skills/eden-todos/scripts/todo.ts update --id abc123 --assignee scout
```

## Commenting on a todo

```bash
npx tsx .agents/skills/eden-todos/scripts/todo.ts comment --id abc123 --author nova --content "Started working on this"
npx tsx .agents/skills/eden-todos/scripts/todo.ts comment --id abc123 --author nova --content "Blocked on API access" --type escalation
```

## Completing a todo

```bash
npx tsx .agents/skills/eden-todos/scripts/todo.ts close --id abc123 --resolution "Landing page deployed"
```

## Dependencies

Todos can depend on other todos. A todo can't start until its dependencies are done:

```bash
npx tsx .agents/skills/eden-todos/scripts/todo.ts create \
  --title "Implement auth" \
  --assignee coder \
  --depends-on design123
```

## Workflow

- **pending** → **in_progress** → **done**
- If blocked: **in_progress** → **blocked** (agent comments with escalation)
- Orchestrator reviews blocked todos, reassigns or creates sub-tasks to unblock
