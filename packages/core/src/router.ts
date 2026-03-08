// @edenup/core — Model Router

import type { AgentConfig } from './types.js'

export type RoutingPurpose =
  | 'planning'
  | 'execution'
  | 'cheap'
  | 'embedding'
  | string

/**
 * Route a model selection for a given purpose based on the agent's
 * router configuration. Returns the model identifier string
 * (e.g. 'claude-sonnet-4-20250514', 'gpt-4o', 'claude-3-5-haiku-20241022').
 *
 * Routing precedence:
 *   1. Explicit route in config.router.routes[purpose]
 *   2. Named shortcut (planning, cheap)
 *   3. Default model
 */
export function routeModel(
  config: AgentConfig,
  purpose: RoutingPurpose = 'execution',
): string {
  const router = config.router

  // 1. Check explicit routes map
  if (router.routes[purpose]) {
    return router.routes[purpose]
  }

  // 2. Check named shortcuts
  switch (purpose) {
    case 'planning':
      return router.planning ?? router.default
    case 'cheap':
      return router.cheap ?? router.default
  }

  // 3. Fall back to default
  return router.default
}
