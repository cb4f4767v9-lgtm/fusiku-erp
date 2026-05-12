import { Request, Response, NextFunction } from 'express';
import { getTenantContext } from '../utils/tenantContext';

/**
 * Requires AsyncLocalStorage tenant context (bound in `authMiddleware`).
 * - Platform / system admins may omit `companyId` on the JWT.
 * - All other users must have a non-empty `companyId`.
 *
 * Branch scope is intentionally NOT enforced here: dashboard and company-wide
 * reports resolve branch via `assertBranchQueryAllowed` in controllers.
 */
export function tenantGuard(_req: Request, res: Response, next: NextFunction) {
  const ctx = getTenantContext();

  if (!ctx) {
    return res.status(500).json({
      error: 'Tenant context was not bound for this request',
      code: 'TENANT_CONTEXT_UNBOUND',
    });
  }

  if (ctx.isSystemAdmin) {
    return next();
  }

  const companyId =
    ctx.companyId != null && typeof ctx.companyId === 'string' ? ctx.companyId.trim() : '';
  if (!companyId) {
    return res.status(403).json({
      error: 'Tenant context required (companyId missing)',
      code: 'TENANT_MISSING',
    });
  }

  next();
}

/**
 * Use on routes that must not run without an assigned branch (e.g. branch-scoped POS mutations).
 * Dashboard and aggregate reports should not use this middleware.
 */
export function requireBranchContext(_req: Request, res: Response, next: NextFunction) {
  const ctx = getTenantContext();
  if (!ctx) {
    return res.status(500).json({
      error: 'Tenant context was not bound for this request',
      code: 'TENANT_CONTEXT_UNBOUND',
    });
  }
  if (ctx.isSystemAdmin) {
    return next();
  }
  const branchId =
    ctx.branchId != null && typeof ctx.branchId === 'string' ? ctx.branchId.trim() : '';
  if (!branchId) {
    return res.status(403).json({
      error: 'Branch context required',
      code: 'BRANCH_REQUIRED',
    });
  }
  next();
}
