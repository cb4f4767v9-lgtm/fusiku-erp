import type { AuthUser } from '../hooks/useAuth';

export type ModuleKey = string;

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.branchRole === 'SUPER_ADMIN' || !user.branchId;
}

export function canAccessBranch(
  user: AuthUser | null | undefined,
  branchId: string | null | undefined
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  const bid = String(user.branchId || '').trim();
  const target = String(branchId || '').trim();

  if (!bid) return false;
  if (!target) return true;

  return bid === target;
}

/**
 * UI permission gating. Uses `user.permissions` from login / GET /auth/me.
 * Backend `requirePermission` remains authoritative.
 */
/** UI module keys may alias legacy backend permission codes (avoid stale "admin.*" labels in nav). */
const MODULE_PERMISSION_ALIASES: Record<string, string[]> = {
  'customers.view': ['admin.customers', 'customers.view'],
};

function permissionVariants(moduleKey: string): string[] {
  const k = String(moduleKey || '').trim();
  const extra = MODULE_PERMISSION_ALIASES[k];
  if (extra?.length) return [...new Set(extra)];
  return [k];
}

export function canAccessModule(
  user: AuthUser | null | undefined,
  moduleKey: ModuleKey
): boolean {
  if (!user) return false;

  const key = String(moduleKey || '').trim();
  if (!key) return true;

  if (isSuperAdmin(user)) return true;

  const perms = user.permissions;
  if (Array.isArray(perms) && perms.length > 0) {
    const variants = permissionVariants(key);
    return variants.some((v) => perms.includes(v));
  }

  // Legacy sessions without a permission list: deny gated modules until user refreshes session (re-login or /auth/me).
  return false;
}
