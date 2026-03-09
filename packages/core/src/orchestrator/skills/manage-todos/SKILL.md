---
name: manage-todos
description: Create, assign, track, and manage todos with dependencies and comments. Use when breaking goals into tasks, assigning work to agents, or handling escalations.
metadata:
  author: edenup
  version: "0.1"
---

# Manage Todos

You have tools to create and manage a todo backlog. Todos are the unit of work in Eden — every goal gets broken into todos, every todo gets assigned to an agent.

## When to use this skill

- The user gives you a goal that requires multiple steps
- You need to assign work to agents
- An agent has escalated a todo (blocked, needs help)
- The user asks about progress

## How todos work

- Each todo has: title, description, assignee, priority, status, and optional project + dependencies
- **Status flow**: pending → in_progress → done (or → blocked if escalated)
- **Dependencies**: a todo can depend on other todos. Agents can't start a todo until its dependencies are done.
- **Comments**: agents comment on their todos with progress or questions. Escalation comments mark the todo as blocked and notify you.
- **Projects**: todos can be associated with a project (e.g. "my-app")

## Best practices

- Break big goals into many small, focused todos
- Set dependencies when order matters
- Assign todos to the agent best suited for the work
- When an agent escalates, review the comments, then either: answer the question via a comment, reassign to another agent, or create new todos to unblock
- Use priority levels: critical > high > medium > low
