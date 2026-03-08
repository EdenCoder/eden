// @edenup/core — MemoryManager

import type {
  AgentMemory,
  AgentContextConfig,
} from './types.js'

export interface ExtractedMemory {
  content: string
  tags: string[]
}

export interface MemoryQuery {
  agentName: string
  query: string
  maxResults: number
  maxTokens: number
  taskId?: string
}

/**
 * Manages long-term agent memory using vector embeddings stored in LanceDB.
 * Provides semantic search over past task learnings, patterns, and knowledge
 * that agents extract from their work.
 */
export class MemoryManager {
  // TODO: Replace with LanceDB table handle
  private memories: Map<string, AgentMemory[]> = new Map()
  private memoryCounter = 0

  constructor() {
    // TODO: Accept Database instance (LanceDB) for vector storage
    // TODO: Accept an embedding model (from AI SDK) for generating vectors
    // TODO: Initialize or open the 'agent_memories' LanceDB table
  }

  /**
   * Extract noteworthy memories from a completed task's conversation
   * and store them with vector embeddings for later retrieval.
   *
   * Extraction is done by prompting the agent's LLM to identify:
   *   - Patterns learned
   *   - Mistakes to avoid
   *   - Domain knowledge acquired
   *   - Preferences discovered
   */
  async extractAndStore(
    agentName: string,
    taskId: string,
    conversationSummary: string,
    _contextConfig: AgentContextConfig,
  ): Promise<AgentMemory[]> {
    // TODO: Use LLM to extract memories from the conversation summary
    //   Prompt: "Given this task conversation, extract 1-5 noteworthy learnings..."
    // TODO: Generate embeddings for each extracted memory using AI SDK embed()
    // TODO: Store in LanceDB agent_memories table with vector index

    // Placeholder: create a single memory from the summary
    const memory: AgentMemory = {
      id: `mem-${++this.memoryCounter}-${Date.now()}`,
      agentName,
      content: conversationSummary,
      embedding: [], // TODO: Generate real embedding via AI SDK embed()
      taskId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
      tags: ['auto-extracted'],
    }

    const agentMemories = this.memories.get(agentName) ?? []
    agentMemories.push(memory)
    this.memories.set(agentName, agentMemories)

    return [memory]
  }

  /**
   * Retrieve semantically relevant memories for a given query.
   * Uses LanceDB vector search to find the closest matches,
   * then ranks by a combination of relevance, recency, and access frequency.
   */
  async retrieve(query: MemoryQuery): Promise<AgentMemory[]> {
    // TODO: Generate embedding for the query string using AI SDK embed()
    // TODO: Perform vector similarity search on LanceDB agent_memories table
    //   - Filter by agentName
    //   - Optionally filter by taskId
    //   - Limit to maxResults
    // TODO: Re-rank results by composite score:
    //   score = similarity * 0.6 + recency * 0.2 + frequency * 0.2
    // TODO: Update lastAccessedAt and accessCount for retrieved memories

    // Placeholder: simple substring match against in-memory store
    const agentMemories = this.memories.get(query.agentName) ?? []
    const queryLower = query.query.toLowerCase()

    const results = agentMemories
      .filter((m) => m.content.toLowerCase().includes(queryLower))
      .slice(0, query.maxResults)

    // Update access metadata
    for (const memory of results) {
      memory.lastAccessedAt = new Date()
      memory.accessCount++
    }

    return results
  }

  /**
   * Delete all memories for an agent (used during agent reset/teardown).
   */
  async clearAgent(agentName: string): Promise<number> {
    const memories = this.memories.get(agentName) ?? []
    const count = memories.length
    this.memories.delete(agentName)

    // TODO: Delete from LanceDB where agentName matches

    return count
  }

  /**
   * Get memory stats for an agent.
   */
  getStats(agentName: string): { totalMemories: number; oldestDate: Date | null } {
    const memories = this.memories.get(agentName) ?? []
    const oldest = memories.length > 0
      ? memories.reduce((min, m) => (m.createdAt < min.createdAt ? m : min)).createdAt
      : null

    return { totalMemories: memories.length, oldestDate: oldest }
  }
}
