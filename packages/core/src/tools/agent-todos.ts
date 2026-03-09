// ============================================================================
// @edenup/core — Worker Agent Tools: Todos
// ============================================================================
// Every worker agent gets these tools so they can manage their assigned work.
// Comments escalate back to the orchestrator for review/reassignment.

import { tool } from 'ai'
import { z } from 'zod'
import type { Database } from '../db.js'

export function createAgentTodoTools(db: Database, agentName: string) {
  return {
    myTodos: tool({
      description: 'List your assigned todos. Shows pending, in_progress, and blocked tasks.',
      parameters: z.object({
        status: z.string().optional().describe('Filter by status: pending, in_progress, blocked, done'),
      }),
      execute: async ({ status }) => {
        const todos = await db.getTodos({ assignee: agentName, status })
        if (todos.length === 0) {
          return { todos: [], message: 'No todos assigned to you.' }
        }
        return {
          todos: todos.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            project: t.project || '(none)',
            dependsOn: t.dependsOn || '(none)',
          })),
          message: `${todos.length} todo(s) assigned to you.`,
        }
      },
    }),

    startTodo: tool({
      description: 'Mark a todo as in_progress. Will fail if dependencies are not met.',
      parameters: z.object({
        id: z.string().describe('Todo ID to start working on'),
      }),
      execute: async ({ id }) => {
        const todo = await db.getTodo(id)
        if (!todo) return { success: false, error: `Todo ${id} not found.` }
        if (todo.assignee !== agentName) return { success: false, error: `Todo ${id} is not assigned to you.` }

        const depsMet = await db.areDependenciesMet(id)
        if (!depsMet) {
          return { success: false, error: `Cannot start — dependencies not yet completed.` }
        }

        await db.updateTodo(id, { status: 'in_progress' })
        return { success: true, message: `Started working on "${todo.title}" (${id}).` }
      },
    }),

    completeTodo: tool({
      description: 'Mark a todo as done. Add a resolution comment explaining what was accomplished.',
      parameters: z.object({
        id: z.string().describe('Todo ID to complete'),
        resolution: z.string().describe('Brief summary of what was done'),
      }),
      execute: async ({ id, resolution }) => {
        const todo = await db.getTodo(id)
        if (!todo) return { success: false, error: `Todo ${id} not found.` }
        if (todo.assignee !== agentName) return { success: false, error: `Todo ${id} is not assigned to you.` }

        await db.addComment(id, agentName, resolution, 'resolution')
        await db.updateTodo(id, { status: 'done' })
        return { success: true, message: `Completed "${todo.title}" (${id}).` }
      },
    }),

    commentOnTodo: tool({
      description: 'Add a comment to a todo. Use for progress updates or questions. Comments are visible to the orchestrator.',
      parameters: z.object({
        id: z.string().describe('Todo ID to comment on'),
        content: z.string().describe('Your comment'),
      }),
      execute: async ({ id, content }) => {
        const todo = await db.getTodo(id)
        if (!todo) return { success: false, error: `Todo ${id} not found.` }

        await db.addComment(id, agentName, content, 'comment')
        return { success: true, message: `Comment added to "${todo.title}" (${id}).` }
      },
    }),

    escalateTodo: tool({
      description: 'Escalate a todo back to the orchestrator. Use when you are blocked, need help, or think the task should be reassigned.',
      parameters: z.object({
        id: z.string().describe('Todo ID to escalate'),
        reason: z.string().describe('Why you are escalating — what is blocking you?'),
      }),
      execute: async ({ id, reason }) => {
        const todo = await db.getTodo(id)
        if (!todo) return { success: false, error: `Todo ${id} not found.` }

        await db.addComment(id, agentName, reason, 'escalation')
        await db.updateTodo(id, { status: 'blocked' })
        return { success: true, message: `Escalated "${todo.title}" (${id}) to orchestrator. Reason: ${reason}` }
      },
    }),
  }
}
