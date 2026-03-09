---
name: eden-agents
description: Create, list, update, and remove Eden sub-agents. Use when the user wants to add team members, modify an agent's persona or config, inspect running agents, or remove agents. Each agent is a folder in agents/ with an agent.config.ts and AGENT.md.
---

# Eden Agents

Agents live in the `agents/` directory. Each agent is a folder containing:

```
agents/nova/
├── agent.config.ts    # Config: name, model, budget, messaging
└── AGENT.md           # Persona: who the agent is, how it behaves
```

## Available scripts

- **`scripts/list-agents.ts`** — List all agents in agents/ with their config
- **`scripts/create-agent.ts`** — Create a new agent (config + persona)
- **`scripts/remove-agent.ts`** — Remove an agent directory

## Creating an agent

```bash
npx tsx .agents/skills/eden-agents/scripts/create-agent.ts \
  --name rex \
  --description "Personal trainer and fitness accountability coach" \
  --personality "Motivating, no-nonsense, celebrates wins but holds you accountable" \
  --model "anthropic/claude-haiku-4.5"
```

This creates `agents/rex/agent.config.ts` and `agents/rex/AGENT.md`.

After creating an agent, Eden will auto-detect it on next boot. To hot-reload without restart, the orchestrator can signal a reload.

## The AGENT.md persona

AGENT.md is the agent's entire personality and system prompt. Write it in first person as if the agent is describing itself. Include:
- Who they are and their role
- Their personality traits
- What they're good at and what they should defer to others
- Any domain-specific knowledge

## The agent.config.ts

Contains structured config: name, description, personality (brief), model routing, budget, daemon mode. See `scripts/create-agent.ts --help` for all options.

## Listing agents

```bash
npx tsx .agents/skills/eden-agents/scripts/list-agents.ts
```

Returns JSON array of all agents with their config.

## Removing an agent

```bash
npx tsx .agents/skills/eden-agents/scripts/remove-agent.ts --name rex
```

Deletes the agent directory.

## Updating an agent

To update an agent's persona, edit `agents/<name>/AGENT.md` directly.
To update config, edit `agents/<name>/agent.config.ts` directly.
The agent picks up AGENT.md changes per-task. Config changes need a restart.
