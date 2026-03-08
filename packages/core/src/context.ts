// @edenup/core — ContextAdapter & ContextBuilder

import type {
  AgentContextConfig,
  ContextFragment,
  CompactedContext,
} from './types.js'

/**
 * Description of the current task, used by context adapters
 * to determine which fragments are relevant.
 */
export interface TaskDescription {
  taskId: string
  agentName: string
  goal: string
  currentMessages: unknown[]
  totalTokens: number
}

/**
 * A ContextAdapter contributes fragments to the agent's context window.
 * Each adapter is responsible for a specific source of context
 * (memory, meeting history, summaries, etc.) and declares its
 * token budget and relevance scoring.
 */
export interface ContextAdapter {
  /** Unique name for this adapter (e.g. 'memory', 'meeting', 'summary') */
  readonly name: string

  /**
   * Retrieve relevant context fragments for the given task.
   * Fragments are ranked by relevance and trimmed to fit within
   * the adapter's token budget.
   */
  retrieve(task: TaskDescription): Promise<ContextFragment[]>

  /**
   * Optional: compact the context when the token limit is approached.
   * Returns a summarized version of the conversation so far.
   */
  compact?(task: TaskDescription): Promise<CompactedContext>
}

/**
 * Builds the final context window for an agent by composing
 * registered ContextAdapters, allocating token budgets, and
 * merging fragments by relevance.
 */
export class ContextBuilder {
  private adapters: Map<string, ContextAdapter> = new Map()

  constructor() {
    // TODO: Accept AgentContextConfig to configure per-adapter budgets
    // TODO: Accept Database for caching context between calls
  }

  /**
   * Register a ContextAdapter. Later registrations with the same name
   * overwrite earlier ones (allows project-level overrides).
   */
  register(adapter: ContextAdapter): void {
    this.adapters.set(adapter.name, adapter)
  }

  /**
   * Build the full context for a task by querying all registered adapters,
   * scoring and deduplicating fragments, and trimming to fit the
   * configured maxTokens budget.
   *
   * Returns fragments sorted by relevance, highest first.
   */
  async build(task: TaskDescription, config: AgentContextConfig): Promise<ContextFragment[]> {
    const allFragments: ContextFragment[] = []

    // Query each adapter in parallel
    const results = await Promise.all(
      Array.from(this.adapters.values()).map(async (adapter) => {
        try {
          const fragments = await adapter.retrieve(task)
          return fragments
        } catch {
          // TODO: Log adapter errors without crashing the build
          return []
        }
      }),
    )

    for (const fragments of results) {
      allFragments.push(...fragments)
    }

    // Sort by relevance descending
    allFragments.sort((a, b) => b.relevance - a.relevance)

    // Trim to fit within the configured token budget
    const maxTokens = config.maxTokens
    const selected: ContextFragment[] = []
    let tokenCount = 0

    for (const fragment of allFragments) {
      if (tokenCount + fragment.tokens > maxTokens) continue
      selected.push(fragment)
      tokenCount += fragment.tokens
    }

    return selected
  }

  /**
   * Trigger compaction across all adapters that support it.
   * Used when the conversation approaches the compaction threshold.
   */
  async compact(task: TaskDescription): Promise<CompactedContext | null> {
    // Find adapters that support compaction
    const compactable = Array.from(this.adapters.values())
      .filter((a): a is ContextAdapter & { compact: NonNullable<ContextAdapter['compact']> } => !!a.compact)

    if (compactable.length === 0) return null

    // TODO: Use the compaction model specified in AgentContextConfig
    //   to produce a unified summary across all compactable adapters
    // TODO: Integrate with LLM to generate the compacted summary

    // Placeholder: use first compactable adapter
    const result = await compactable[0].compact(task)
    return result
  }

  /**
   * Get all registered adapter names.
   */
  getAdapterNames(): string[] {
    return Array.from(this.adapters.keys())
  }
}
