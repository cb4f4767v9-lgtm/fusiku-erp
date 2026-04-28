import type { NextFunction, Response } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  userId: string;
  /**
   * Optional for platform/system admins (who may operate without an implicit tenant),
   * required for all non-admin requests (enforced by middleware/runtime guards).
   */
  companyId?: string;
  branchId?: string;
  branchRole?: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER';
  isSystemAdmin?: boolean;
};

export const PLATFORM_ADMIN_ROLE_NAMES = new Set(['SYSTEM_ADMIN']);

export function isPlatformAdminRole(roleName?: string | null): boolean {
  return !!roleName && PLATFORM_ADMIN_ROLE_NAMES.has(roleName.toUpperCase());
}

const storage = new AsyncLocalStorage<TenantContext>();

// ================= CORE CONTEXT =================

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function runTenantContextForHttpRequest(
  ctx: TenantContext,
  _res: Response,
  next: NextFunction
): void {
  // Clean + safe execution (no hanging promise, no silent failure)
  storage.run(ctx, () => {
    next();
  });
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function requireTenantContext(): TenantContext {
  const ctx = getTenantContext();

  if (!ctx) {
    throw new Error('FATAL: Tenant context missing (request not wrapped)');
  }

  return ctx;
}

// ================= HELPERS =================

export function requireTenantCompanyId(): string {
  const ctx = requireTenantContext();

  if (ctx.isSystemAdmin) {
    throw new Error('System admin must specify tenant explicitly');
  }

  if (!ctx.companyId) {
    throw new Error('Tenant companyId missing');
  }

  return ctx.companyId;
}

export function requireBranchId(): string {
  const ctx = requireTenantContext();

  if (!ctx.branchId) {
    throw new Error('Branch context required');
  }

  return ctx.branchId;
}

export function getSafeCompanyId(): string | null {
  const ctx = getTenantContext();

  if (!ctx) return null;
  if (ctx.isSystemAdmin) return null;

  if (!ctx.companyId) {
    throw new Error('Missing tenant companyId');
  }

  return ctx.companyId;
}

export function isTenantSystemAdmin(): boolean {
  return !!getTenantContext()?.isSystemAdmin;
}

export function debugTenantContext() {
  return getTenantContext();
}