---
name: sub-agents
description: Spawn short-lived sub-agents for focused, parallel subtasks. Use when a task is decomposable into independent pieces, when you need to sandbox a risky operation, or when you want to work on multiple things concurrently.
metadata:
  author: edenup
  version: "0.1"
---

# Sub-Agents

You can spawn short-lived sub-agents to handle focused, scoped tasks. Sub-agents are ephemeral workers that you spin up, delegate to, and collect results from.

## When to use this skill

- A task is decomposable into independent subtasks that can run in parallel
- A subtask requires a different model or tool configuration than you
- You want to sandbox a risky operation (the sub-agent has its own budget cap)
- You need to do deep work on one thing while continuing to be available

## How it works

1. Define the task, budget, and optional overrides (model, tools, skills)
2. The sub-agent boots, runs the task, returns a result, and terminates
3. The sub-agent's cost is deducted from YOUR budget
4. Sub-agent output streams to your verbose channel, tagged with the sub-agent's name

## Rules

- Sub-agents are **one level deep only** — a sub-agent cannot spawn its own sub-agents
- Sub-agents have **no messaging channels** — they're invisible to humans
- Sub-agents inherit your tools and skills by default unless you override them
- Sub-agents have a **timeout** (default 5 minutes) — if they haven't finished, they're killed
- Budget for sub-agents comes from YOUR budget — plan accordingly

## Example

If you need to research 4 competitors in parallel:
- Spawn 4 sub-agents, each with a $0.25 budget and the "competitor-analysis" task
- Collect all 4 results
- Synthesize into a unified analysis

This is faster than doing them sequentially and keeps each sub-task focused.
