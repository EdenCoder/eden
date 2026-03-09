---
name: eden-cron
description: Create, list, and manage recurring scheduled tasks (crons). Use when the user wants something to happen on a schedule — daily meal plans, morning briefings, weekly check-ins, hourly monitoring, etc.
---

# Eden Cron

Crons are recurring tasks that fire on a schedule. The agent daemon checks crons every tick and dispatches due ones to their assigned agent.

## Available scripts

- **`scripts/cron.ts`** — Create, list, and remove crons

## Creating a cron

```bash
npx tsx .agents/skills/eden-cron/scripts/cron.ts add \
  --name "morning-workout" \
  --schedule "daily" \
  --assignee coach-rex \
  --description "Post today's workout plan to the user"
```

## Schedule formats

- `daily` — once every 24 hours
- `hourly` — once every hour
- `every 30m` — every 30 minutes
- `every 2h` — every 2 hours
- `every 3d` — every 3 days

## Listing crons

```bash
npx tsx .agents/skills/eden-cron/scripts/cron.ts list
```

## Removing a cron

```bash
npx tsx .agents/skills/eden-cron/scripts/cron.ts remove --id abc123
```

## How it works

The agent daemon runs on a loop. Each tick it:
1. Checks all enabled crons
2. For any that are due (based on schedule + lastRan), dispatches to the assigned agent
3. The agent runs the cron's description as a task and posts results to Discord
4. lastRan is updated to prevent double-firing

Crons are idempotent per-interval — they won't fire twice in the same period.
