type BranchRole = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER';

export type BranchScopedUser = {
  companyId?: string;
  branchId?: string | null;
  /** Optional for backward compatibility with older tokens. */
  branchRole?: BranchRole | null;
  /** Platform admin bypass (cross-tenant). */
  isSystemAdmin?: boolean | null;
};

function normalizeBranchId(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

function effectiveRole(user: BranchScopedUser): BranchRole {
  const r = String(user.branchRole || '').trim().toUpperCase();
  if (r === 'SUPER_ADMIN' || r === 'BRANCH_ADMIN' || r === 'BRANCH_USER') return r as BranchRole;
  // Backward-compatible default: if token doesn't carry a branchRole, treat as branch-restricted.
  return 'BRANCH_USER';
}

function isSuperAdmin(user: BranchScopedUser): boolean {
  return user.isSystemAdmin === true || effectiveRole(user) === 'SUPER_ADMIN';
}

function requireUserBranchId(user: BranchScopedUser): string {
  const bid = normalizeBranchId(user.branchId);
  if (!bid) {
    const err: any = new Error('Branch context required for this operation');
    err.statusCode = 403;
    err.code = 'BRANCH_REQUIRED';
    throw err;
  }
  return bid;
}

/**
 * Injects branchId restriction into Prisma where objects.
 *
 * - SUPER_ADMIN: no branch restriction added.
 * - BRANCH_ADMIN/BRANCH_USER: forces branchId = user.branchId
 * - If caller attempted to query another branch explicitly -> reject.
 */
export function applyBranchScope<TWhere extends Record<string, any> | undefined>(
  user: BranchScopedUser,
  where: TWhere
): TWhere {
  if (isSuperAdmin(user)) return where;

  const branchId = requireUserBranchId(user);
  const w: any = where ? { ...where } : {};

  // If caller explicitly asked for a different branch, reject.
  if (w.branchId != null) {
    const requested = normalizeBranchId(w.branchId);
    if (requested && requested !== branchId) {
      const err: any = new Error('Forbidden: cross-branch access');
      err.statusCode = 403;
      err.code = 'BRANCH_FORBIDDEN';
      throw err;
    }
  }

  // Enforce branchId for all queries.
  if (Object.prototype.hasOwnProperty.call(w, 'AND') && Array.isArray(w.AND)) {
    w.AND = [...w.AND, { branchId }];
    return w as TWhere;
  }

  if (Object.keys(w).length === 0) {
    return ({ branchId } as any) as TWhere;
  }

  return ({ AND: [w, { branchId }] } as any) as TWhere;
}

/**
 * Enforces branch correctness for writes. Does not mutate payloads; it validates intent.
 *
 * Rules:
 * - SUPER_ADMIN: allowed.
 * - Branch roles: branchId must be absent OR match user's branchId.
 * - If user has no branch: reject.
 */
export function enforceBranchWrite(
  user: BranchScopedUser,
  data: { branchId?: unknown } | null | undefined
): void {
  if (isSuperAdmin(user)) return;

  const branchId = requireUserBranchId(user);
  const requested = normalizeBranchId(data?.branchId);
  if (requested && requested !== branchId) {
    const err: any = new Error('Forbidden: cannot write to another branch');
    err.statusCode = 403;
    err.code = 'BRANCH_WRITE_FORBIDDEN';
    throw err;
  }
}

