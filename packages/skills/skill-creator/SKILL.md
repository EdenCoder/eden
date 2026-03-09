---
name: skill-creator
description: Guide for creating effective skills. Use when users want to create a new skill (or update an existing skill) that extends agent capabilities with specialized knowledge, workflows, or tool integrations.
---

# Skill Creator

Skills are modular packages that extend agent capabilities by providing specialized knowledge, workflows, and tools.

## Core Principles

### Concise is Key
The context window is a shared resource. Only add context the agent doesn't already have. Challenge each piece: "Does the agent really need this?"

### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/      - Executable TypeScript (tsx) scripts
    ├── references/   - Documentation
    └── assets/       - Templates, images
```

### SKILL.md Format

```markdown
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---

# My Skill Name

[Instructions for the agent when this skill is active]

## Available scripts

- **`scripts/do-thing.ts`** — Does a thing

## Examples
- Example usage 1
- Example usage 2
```

## Skill Creation Process

### Step 1: Understand with Examples
Gather concrete examples of how the skill will be used.

### Step 2: Plan Reusable Contents
Analyze examples to identify:
- **Scripts**: TypeScript code that does real work (file I/O, API calls, DB queries)
- **References**: Documentation the agent needs to reference
- **Assets**: Templates for output

### Step 3: Initialize
Create the skill directory structure with SKILL.md and resource folders.

### Step 4: Implement
- Start with reusable scripts (always TypeScript, run with `npx tsx`)
- Write clear SKILL.md with proper frontmatter
- Test scripts by actually running them

### Step 5: Iterate
Use the skill on real tasks, notice struggles, improve.

## Script Convention

All scripts in Eden skills are TypeScript and run with `npx tsx`:

```bash
npx tsx scripts/create-agent.ts --name nova --description "Creative strategist"
```

Scripts should:
- Accept all input via CLI flags (no interactive prompts)
- Output JSON to stdout for structured data
- Write errors to stderr
- Use `--help` for usage docs
- Be idempotent where possible

## Progressive Disclosure

Keep SKILL.md under 500 lines. Split content into references/:

```markdown
## Advanced features
- **Form filling**: See [references/forms.md](references/forms.md)
```

## What NOT to Include

- README.md, CHANGELOG.md, user-facing docs
- Skills are for AI agents, not humans
