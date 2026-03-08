---
name: agent-management
description: Manage agent lifecycles — health monitoring, budget enforcement, self-healing, skill updates. Use when agents need restarts, config changes, or when the system needs health checks.
metadata:
  author: edenup
  version: "0.1"
---

# Agent Management

You manage the lifecycle of all agents in the system.

## When to use this skill

- An agent is unhealthy (missed heartbeats, error looping)
- Budget limits are approaching or exceeded
- An agent needs skill or config updates
- The daily health report is due

## Health monitoring

Check agent heartbeats every cycle. If an agent hasn't heartbeated in 2x its configured interval:

1. Send a ping
2. If no response, restart (up to 3 attempts)
3. If still failing, analyze the error pattern
4. If error is fixable (bad config, broken tool), fix and restart
5. If unfixable, kill the agent and notify the human

## Self-healing decision tree

- Crashed → Restart
- Error looping → Analyze: tool failure? switch model? config issue?
- Over budget → Pause + notify
- Stale → Ping → Restart if no response

## Skill updates

You can update any agent's skills by writing to their `skills/` directory. The agent will pick up changes on its next task (per-task progressive disclosure). No restart needed for skill changes.

Install community skills from skills.sh using `npx skills add <owner/repo>`.

Config and tool changes require a restart.
