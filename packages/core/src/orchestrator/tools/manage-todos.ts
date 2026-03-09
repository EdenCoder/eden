// ============================================================================
// @edenup/core — Orchestrator Tools: Manage Todos
// ============================================================================

import { tool } from 'ai'
import { z } from 'zod'
import type { Database } from '../../db.js'

export function createManageTodoTools(db: Database) {
  return {
    createTodo: tool({
      description: 'Create a new todo/task and assign it to an agent. Supports dependencies on other todos and project association.',
      parameters: z.object({
        title: z.string().describe('Short title for the task'),
        description: z.string().describe('Detailed description of what needs to be done'),
        assignee: z.string().describe('Agent name to assign this to (must be a running agent)'),
        priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        project: z.string().optional().describe('Project name this todo belongs to (e.g. "my-app")'),
        dependsOn: z.array(z.string()).optional().describe('Array of todo IDs that must be completed first'),
      }),
      execute: async ({ title, description, assignee, priority, project, dependsOn }) => {
        const id = await db.addTodo({
          title,
          description,
          assignee,
          priority,
          createdBy: 'orchestrator',
          project,
          dependsOn,
        })
        return { success: true, id, message: `Todo "${title}" created (${id}) and assigned to ${assignee}.` }
      },
    }),

    listTodos: tool({
      description: 'List todos, optionally filtered by assignee, status, or project.',
      parameters: z.object({
        assignee: z.string().optional().describe('Filter by assigned agent name'),
        status: z.string().optional().describe('Filter by status: pending, in_progress, blocked, done'),
        project: z.string().optional().describe('Filter by project name'),
      }),
      execute: async ({ assignee, status, project }) => {
        const todos = await db.getTodos({ assignee, status, project })
        if (todos.length === 0) {
          return { todos: [], message: 'No todos found matching the filter.' }
        }
        return {
          todos: todos.map((t: any) => ({
            id: t.id,
            title: t.title,
            assignee: t.assignee,
            status: t.status,
            priority: t.priority,
            project: t.project || '(none)',
            dependsOn: t.dependsOn || '(none)',
          })),
          message: `${todos.length} todo(s) found.`,
        }
      },
    }),

    updateTodo: tool({
      description: 'Update a todo — change its status, reassign it, or modify its details.',
      parameters: z.object({
        id: z.string().describe('The todo ID to update'),
        status: z.enum(['pending', 'in_progress', 'blocked', 'done']).optional(),
        assignee: z.string().optional().describe('Reassign to a different agent'),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ id, ...updates }) => {
        const todo = await db.getTodo(id)
        if (!todo) return { success: false, error: `Todo ${id} not found.` }

        // Check dependencies if trying to start
        if (updates.status === 'in_progress') {
          const depsMet = await db.areDependenciesMet(id)
          if (!depsMet) {
            return { success: false, error: `Cannot start todo ${id} — dependencies are not yet completed.` }
          }
        }

        await db.updateTodo(id, updates)
        return { success: true, message: `Todo ${id} updated.` }
      },
    }),

    commentOnTodo: tool({
      description: 'Add a comment to a todo. Use for progress updates, questions, or escalations.',
      parameters: z.object({
        todoId: z.string().describe('The todo ID to comment on'),
        content: z.string().describe('The comment text'),
        type: z.enum(['comment', 'escalation', 'resolution']).default('comment').describe('Comment type. Use "escalation" when an agent is stuck and needs help.'),
      }),
      execute: async ({ todoId, content, type }) => {
        const commentId = await db.addComment(todoId, 'orchestrator', content, type)
        return { success: true, commentId, message: `Comment added to todo ${todoId}.` }
      },
    }),

    getTodoDetails: tool({
      description: 'Get full details of a specific todo including all comments and dependency status.',
      parameters: z.object({
        id: z.string().describe('The todo ID'),
      }),
      execute: async ({ id }) => {
        const todo = await db.getTodo(id)
        if (!todo) return { error: `Todo ${id} not found.` }

        const comments = await db.getComments(id)
        const depsMet = await db.areDependenciesMet(id)

        return {
          ...todo,
          comments,
          dependenciesMet: depsMet,
        }
      },
    }),

    deleteTodo: tool({
      description: 'Delete a todo permanently.',
      parameters: z.object({
        id: z.string().describe('The todo ID to delete'),
      }),
      execute: async ({ id }) => {
        await db.deleteTodo(id)
        return { success: true, message: `Todo ${id} deleted.` }
      },
    }),
  }
}
