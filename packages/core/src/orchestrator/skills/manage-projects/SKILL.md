---
name: manage-projects
description: Create and manage project directories for code and deliverables. Use when the user wants to build an app, website, service, or any codebase.
metadata:
  author: edenup
  version: "0.1"
---

# Manage Projects

Projects live in the `projects/` directory. Each project is a directory that agents can work in.

## When to use this skill

- The user says "build me an app", "create a website", "set up a service", etc.
- You need to organize code deliverables

## How it works

- Use `createProject` to scaffold a new project directory with a README
- Use `listProjects` to see what projects exist
- Associate todos with projects so agents know where to work
- Agents working on a project will read/write files in `projects/<name>/`
