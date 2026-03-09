---
name: eden-projects
description: Create and manage project directories for code and deliverables. Use when the user wants to build an app, website, service, or any codebase. Projects live in the projects/ directory.
---

# Eden Projects

Projects live in `projects/`. Each project is a directory that agents work in.

## Available scripts

- **`scripts/project.ts`** — Create and list projects

## Creating a project

```bash
npx tsx .agents/skills/eden-projects/scripts/project.ts create \
  --name my-app \
  --description "A motivation tracking mobile app" \
  --type app
```

Creates `projects/my-app/` with a README.

## Listing projects

```bash
npx tsx .agents/skills/eden-projects/scripts/project.ts list
```

## Workflow

1. Create a project with `createProject`
2. Associate todos with the project name
3. Agents working on todos for that project read/write files in `projects/<name>/`
