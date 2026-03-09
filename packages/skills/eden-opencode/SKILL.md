---
name: eden-opencode
description: Run OpenCode to perform complex file operations, code generation, refactoring, or any task that benefits from a full coding agent. Use when you need to write code, edit files, scaffold projects, or do anything that requires reading and modifying multiple files intelligently.
---

# Eden OpenCode

OpenCode is a coding agent CLI. Use it for complex file operations that go beyond simple script execution — writing code, refactoring, scaffolding projects, editing multiple files, etc.

## How to use

```bash
opencode run "Create a Next.js app in projects/my-app with Tailwind CSS and a landing page"
```

```bash
opencode run "Refactor agents/nova/AGENT.md to be more sarcastic and less formal"
```

```bash
opencode run "Add a new API route to projects/my-app/src/app/api/health/route.ts that returns {status: 'ok'}"
```

## When to use OpenCode vs scripts

- **Use scripts** for structured, repeatable operations (create agent, manage todos, list projects)
- **Use OpenCode** for creative, complex, or multi-file tasks (write code, refactor, design, scaffold)

## Guidelines

- Be specific in your prompt — tell OpenCode exactly what files to create/edit and what content
- OpenCode has full filesystem access to the project root
- OpenCode runs with a 2-minute timeout
- OpenCode output can be long — it will return a summary of what it did
