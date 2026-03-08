---
name: find-skills
description: Search for and install agent skills from skills.sh, the open agent skills ecosystem. Use when you need a new capability, when a task would benefit from specialized knowledge, or when the orchestrator is provisioning a new agent.
metadata:
  author: edenup
  version: "0.1"
---

# Find Skills

Search for and install agent skills from [skills.sh](https://skills.sh), the open ecosystem for agent skills.

## When to use this skill

- You need a capability you don't currently have
- The orchestrator is provisioning a new agent and needs skills for it
- A task would benefit from specialized knowledge (e.g., Supabase best practices, PDF processing)
- You want to check if a community skill exists before writing one from scratch

## How to search

Browse or search skills.sh for relevant skills. Popular categories:
- Frontend/React best practices
- Database design patterns
- Testing strategies
- Marketing and content
- DevOps and deployment
- Document processing (PDF, DOCX, XLSX)

## How to install

Install a skill using the skills CLI:

```bash
npx skills add <owner/repo>/<skill-name>
```

Skills are installed into the agent's skills directory and follow the Agent Skills spec (SKILL.md with frontmatter).

## Evaluation criteria

Before installing a skill, evaluate:
- **Relevance** — Does it match what's needed?
- **Quality** — Is it well-written with clear instructions?
- **Install count** — Higher installs suggest community trust
- **Source** — Prefer skills from official orgs (anthropics, vercel-labs, microsoft, etc.)

## After installation

Once installed, the skill is available for the agent to load on demand via the `loadSkill` tool. It will appear in the agent's available skills list at the start of each new task.
