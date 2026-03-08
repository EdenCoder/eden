// @edenup/core — Access Control

import type { AccessConfig, RoleName } from './types.js'

export type Permission =
  | 'command' | 'approve' | 'interact'
  | 'view_verbose' | 'view_control' | 'view_human'

export function getUserRole(userId: string, access: AccessConfig): RoleName | 'owner' | null {
  if (userId === access.owner) return 'owner'
  for (const [roleName, roleConfig] of Object.entries(access.roles)) {
    if (roleConfig.userIds.includes(userId)) return roleName as RoleName
  }
  return null
}

export function hasPermission(userId: string, permission: Permission, access: AccessConfig): boolean {
  const role = getUserRole(userId, access)
  if (!role) return false
  if (role === 'owner') return true
  const cfg = access.roles[role]
  switch (permission) {
    case 'command': return cfg.canCommand ?? false
    case 'approve': return cfg.canApprove ?? false
    case 'interact': return role !== 'guest'
    case 'view_verbose': return cfg.canViewVerbose ?? false
    case 'view_control': return cfg.canViewControl ?? false
    case 'view_human': return true
    default: return false
  }
}

export function isKnownUser(userId: string, access: AccessConfig): boolean {
  return getUserRole(userId, access) !== null
}

export function getMessagePriority(userId: string, access: AccessConfig): number {
  const role = getUserRole(userId, access)
  switch (role) {
    case 'owner': return 100
    case 'admin': return 80
    case 'operator': return 60
    case 'viewer': return 40
    case 'guest': return 20
    default: return 0
  }
}
