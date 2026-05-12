import type { RequestHandler } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';

/** Head office / tenant admin: no branch assignment → can query all branches in the company. */
export function isHeadOfficeUser(user: AuthRequest['user'] | undefined): boolean {
  return !!user && !user.branchId;
}

/**
 * Resolves which branch filter to apply for reads.
 * Branch-assigned users cannot query another branch: mismatch → 403.
 */
export function assertBranchQueryAllowed(
  user: AuthRequest['user'] | undefined,
  queryBranchId?: string | null
): string | undefined {
  const q = typeof queryBranchId === 'string' && queryBranchId.trim() ? queryBranchId.trim() : undefined;
  if (!user?.branchId) return q;
  if (q && q !== user.branchId) {
    const e = new Error('You can only access your assigned branch.');
    (e as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 403;
    throw e;
  }
  return user.branchId;
}

/**
 * Validates an explicit `branchId` from params/body against the JWT (non–super-admin users).
 * Use when the client sends a branch id that must match the user's scope.
 */
export function assertRequestedBranchMatchesUser(
  user: AuthRequest['user'] | undefined,
  requestedBranchId: string | null | undefined
): void {
  if (user?.isSystemAdmin) return;
  const reqB = typeof requestedBranchId === 'string' && requestedBranchId.trim() ? requestedBranchId.trim() : undefined;
  if (!reqB) return;
  const ub = typeof user?.branchId === 'string' && user.branchId.trim() ? user.branchId.trim() : undefined;
  if (ub && reqB !== ub) {
    const e = new Error('Forbidden: branch mismatch');
    (e as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 403;
    throw e;
  }
}

/** Express middleware: rejects cross-branch `?branchId=` for branch-scoped users. */
export const branchQueryGuard: RequestHandler = (req, res, next) => {
  try {
    assertBranchQueryAllowed((req as AuthRequest).user, req.query.branchId as string);
    next();
  } catch (e: any) {
    const code = e?.statusCode || 403;
    res.status(code).json({ error: e.message });
  }
};
