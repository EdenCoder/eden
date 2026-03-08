---
name: manage-agents
description: Create, update, list, and remove sub-agents on the fly. Use when the human asks you to add a new team member, modify an existing agent's personality/model/budget, inspect what agents are running, or remove one.
metadata:
  author: edenup
  version: "0.1"
---

# Manage Agents

You have tools to create, update, list, and remove sub-agents at runtime. Agents are persisted as folders in the user's `agents/` directory and are hot-loaded on creation.

## When to use this skill

- The human asks you to "add an agent", "hire someone", "create a researcher", etc.
- The human asks you to change an agent's personality, model, budget, or description.
- The human asks "who's on the team?" or "list agents".
- The human asks to fire/remove an agent.

## Creating an agent

Use the `createAgent` tool. You must decide:

1. **name** — short, lowercase, no spaces. This becomes the folder name and the @mention name in Discord.
2. **description** — one sentence about what this agent does.
3. **personality** — 2-3 personality traits that shape how the agent communicates.
4. **model** — the OpenRouter model string (default: `anthropic/claude-3.5-haiku` for cheap agents, `anthropic/claude-3.7-sonnet` for smarter ones).
5. **budgetPerDay** — daily spend cap in USD.

The agent will immediately boot and start listening for @mentions in Discord. It will appear as a distinct persona using its own name and avatar.

## Updating an agent

Use the `updateAgent` tool. You can change personality, description, model, or budget. The agent will be restarted with the new config.

## Listing agents

Use the `listAgents` tool. It returns all currently running agents with their name, description, personality, model, and budget.

## Removing an agent

Use the `removeAgent` tool. This stops the agent daemon and deletes its config folder.

## Guidelines

- Always confirm with the human before creating or removing agents.
- Give agents distinct personalities — it produces better, more diverse outputs.
- Start agents with cheap models (haiku) unless the human specifically needs a smarter one.
- Budget conservatively. $2-5/day is reasonable for most agents.
