// ============================================================================
// @edenup/core — Orchestrator Tools: Manage Projects
// ============================================================================

import { tool } from 'ai'
import { z } from 'zod'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export function createManageProjectTools() {
  const projectsPath = resolve(process.cwd(), 'projects')

  return {
    createProject: tool({
      description: 'Create a new project directory under projects/. Use this when the user wants to build something — an app, a website, a service, etc.',
      parameters: z.object({
        name: z.string().regex(/^[a-z][a-z0-9-]*$/).describe('Project name (lowercase, hyphenated). Becomes the directory name.'),
        description: z.string().describe('One-line description of the project.'),
        type: z.enum(['app', 'website', 'service', 'library', 'other']).default('app'),
      }),
      execute: async ({ name, description, type }) => {
        const projectDir = join(projectsPath, name)

        try {
          await mkdir(projectDir, { recursive: true })

          // Write a project README
          await writeFile(join(projectDir, 'README.md'), `# ${name}\n\n${description}\n\nType: ${type}\nCreated: ${new Date().toISOString()}\n`)

          return { success: true, path: projectDir, message: `Project "${name}" created at projects/${name}/` }
        } catch (error) {
          return { success: false, error: `Failed to create project: ${error}` }
        }
      },
    }),

    listProjects: tool({
      description: 'List all projects in the projects/ directory.',
      parameters: z.object({}),
      execute: async () => {
        try {
          await mkdir(projectsPath, { recursive: true })
          const entries = await readdir(projectsPath, { withFileTypes: true })
          const projects = entries.filter(e => e.isDirectory()).map(e => e.name)

          if (projects.length === 0) {
            return { projects: [], message: 'No projects yet. Use createProject to start one.' }
          }

          return { projects, message: `${projects.length} project(s) found.` }
        } catch {
          return { projects: [], message: 'No projects directory found.' }
        }
      },
    }),
  }
}
