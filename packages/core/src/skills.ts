// ============================================================================
// @edenup/core — Skill Discovery & Loading (Agent Skills Spec)
// ============================================================================
// Implements the AI SDK Agent Skills pattern:
//   1. Discovery: scan directories, extract name + description from SKILL.md frontmatter
//   2. Activation: loadSkill tool reads full SKILL.md body into context on demand
//   3. Resources: agent uses standard tools to access scripts/, references/, assets/
//
// Compatible with skills.sh ecosystem — npx skills add <owner/repo>

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'

// --- Types ---

export interface SkillMetadata {
  name: string
  description: string
  path: string // Absolute path to skill directory
  compatibility?: string
  metadata?: Record<string, string>
}

// --- Discovery (runs at boot — lightweight, metadata only) ---

export async function discoverSkills(directories: string[]): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = []
  const seenNames = new Set<string>()

  for (const dir of directories) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue // Skip directories that don't exist
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillDir = join(dir, entry.name)
      const skillFile = join(skillDir, 'SKILL.md')

      try {
        const content = await readFile(skillFile, 'utf-8')
        const frontmatter = parseFrontmatter(content)

        // First skill with a given name wins (allows project overrides)
        if (seenNames.has(frontmatter.name)) continue
        seenNames.add(frontmatter.name)

        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
          path: skillDir,
          compatibility: frontmatter.compatibility,
          metadata: frontmatter.metadata,
        })
      } catch {
        continue // Skip skills without valid SKILL.md
      }
    }
  }

  return skills
}

// --- System Prompt Fragment ---

export function buildSkillsPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) return ''

  const skillsList = skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join('\n')

  return `
## Skills

Use the \`loadSkill\` tool to load a skill when your current task
would benefit from specialized instructions. Only load skills that
are relevant to the task at hand.

Available skills:
${skillsList}
`.trim()
}

// --- loadSkill Tool (AI SDK tool()) ---

export function loadSkillTool(skills: SkillMetadata[]) {
  return tool({
    description: 'Load a skill to get specialized instructions for a task. Returns the full skill content and the skill directory path for accessing bundled scripts/references.',
    parameters: z.object({
      name: z.string().describe('The skill name to load'),
    }),
    execute: async ({ name }) => {
      const skill = skills.find(
        (s) => s.name.toLowerCase() === name.toLowerCase(),
      )

      if (!skill) {
        return { error: `Skill '${name}' not found. Available: ${skills.map(s => s.name).join(', ')}` }
      }

      const skillFile = join(skill.path, 'SKILL.md')
      const content = await readFile(skillFile, 'utf-8')
      const body = stripFrontmatter(content)

      return {
        skillDirectory: skill.path,
        content: body,
      }
    },
  })
}

// --- Frontmatter Parsing ---

interface Frontmatter {
  name: string
  description: string
  compatibility?: string
  metadata?: Record<string, string>
}

function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match?.[1]) throw new Error('No frontmatter found')

  // Simple YAML-like parsing (name: value) — avoids yaml dependency
  const lines = match[1].split('\n')
  const result: Record<string, unknown> = {}
  let currentKey: string | null = null
  let inMetadata = false
  const metadata: Record<string, string> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed === 'metadata:') {
      inMetadata = true
      continue
    }

    if (inMetadata && line.startsWith('  ')) {
      const [key, ...valueParts] = trimmed.split(':')
      if (key && valueParts.length > 0) {
        metadata[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '')
      }
      continue
    } else if (inMetadata) {
      inMetadata = false
    }

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      currentKey = trimmed.slice(0, colonIndex).trim()
      const value = trimmed.slice(colonIndex + 1).trim()
      result[currentKey] = value.replace(/^["']|["']$/g, '')
    }
  }

  if (Object.keys(metadata).length > 0) {
    result.metadata = metadata
  }

  if (!result.name || !result.description) {
    throw new Error('SKILL.md frontmatter must have name and description')
  }

  return result as unknown as Frontmatter
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return match ? content.slice(match[0].length).trim() : content.trim()
}
