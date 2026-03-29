import type { NextFunction, Response } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  userId: string;
  /** Set for normal tenant users; may be empty when platform admin has no tenant row. */
  companyId: string;
  branchId?: string;
  /** Platform super-admin: Prisma tenant middleware does not enforce companyId. */
  isSystemAdmin?: boolean;
};

/** Canonical role names for platform-level (cross-tenant) access. */
export const PLATFORM_ADMIN_ROLE_NAMES = new Set(['SYSTEM_ADMIN', 'SystemAdmin']);

export function isPlatformAdminRole(roleName?: string | null): boolean {
  return !!roleName && PLATFORM_ADMIN_ROLE_NAMES.has(roleName);
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Keeps tenant context alive for the whole HTTP request, including async route handlers.
 * Sync `runWithTenantContext(ctx, () => next())` exits as soon as `next()` returns, so
 * `await` continuations lose the store → Prisma sees no companyId → tenant isolation error.
 */
export function runTenantContextForHttpRequest(
  ctx: TenantContext,
  res: Response,
  next: NextFunction
): void {
  void storage.run(ctx, async () => {
    try {
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        res.once('finish', done);
        res.once('close', done);
        try {
          next();
        } catch {
          done();
        }
      });
    } catch {
      /* avoid unhandled rejection */
    }
  });
}

export function isTenantSystemAdmin(): boolean {
  return !!getTenantContext()?.isSystemAdmin;
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Use in authenticated request handlers / services that run under authMiddleware. */
export function requireTenantCompanyId(): string {
  const c = getTenantContext()?.companyId;
  if (!c) {
    const err = new Error('Tenant context required');
    (err as any).statusCode = 403;
    throw err;
  }
  return c;
}

