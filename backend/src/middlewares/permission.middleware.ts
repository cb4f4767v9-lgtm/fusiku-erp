import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from './auth.middleware';
import { isPlatformAdminRole } from '../utils/tenantContext';
import { logger } from '../utils/logger';

/**
 * In-process cache of `roleId → Set<permissionCode>`.
 * RolePermission rows change rarely (admin UI only), but `requirePermission`
 * runs on every authenticated request — caching avoids a slow `findMany`
 * (with `include: permission`) per call. TTL is short enough that a manual
 * permission edit is reflected within ~30s without a server restart.
 */
const PERMISSIONS_CACHE_TTL_MS = 30_000;
const permissionsCache = new Map<string, { codes: Set<string>; cachedAtMs: number }>();
const inFlight = new Map<string, Promise<Set<string>>>();

async function loadPermissionsForRole(roleId: string): Promise<Set<string>> {
  const now = Date.now();
  const hit = permissionsCache.get(roleId);
  if (hit && now - hit.cachedAtMs < PERMISSIONS_CACHE_TTL_MS) {
    return hit.codes;
  }

  const pending = inFlight.get(roleId);
  if (pending) return pending;

  const promise = (async () => {
    const rows = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { code: true } } },
    });
    const codes = new Set<string>();
    for (const r of rows) {
      const c = r.permission?.code;
      if (typeof c === 'string' && c) codes.add(c);
    }
    permissionsCache.set(roleId, { codes, cachedAtMs: Date.now() });
    return codes;
  })().finally(() => {
    inFlight.delete(roleId);
  });

  inFlight.set(roleId, promise);
  return promise;
}

/** Allow admin UIs to invalidate the cache after editing role assignments. */
export function invalidateRolePermissionCache(roleId?: string) {
  if (roleId) {
    permissionsCache.delete(roleId);
  } else {
    permissionsCache.clear();
  }
}

export function requirePermission(...permissionCodes: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    if (req.user.branchRole === 'SUPER_ADMIN') {
      return next();
    }

    const path = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+/g, '/');
    const isPlatformRoute = /\/v1\/admin(\/|$)/.test(path) || /^\/api\/v1\/admin(\/|$)/.test(path);
    if (isPlatformRoute && (req.user.isSystemAdmin || isPlatformAdminRole(req.user.roleName))) {
      return next();
    }

    try {
      const codes = await loadPermissionsForRole(String(req.user.roleId || ''));
      const hasPermission = permissionCodes.some((c) => codes.has(c));
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions.' });
      }
      return next();
    } catch (e) {
      logger.error({ err: e, roleId: req.user.roleId }, '[permission] check failed');
      return res.status(500).json({ error: 'Permission check failed.' });
    }
  };
}
