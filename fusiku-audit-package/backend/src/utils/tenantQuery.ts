/**
 * Defense-in-depth helpers for tenant-scoped Prisma access.
 *
 * Prisma `$use` middleware only auto-merges `companyId` for some actions (`findFirst`, `findMany`, …).
 * Single-row actions (`findUnique`, `update`, `delete`, `upsert`) are not automatically scoped — callers must
 * include `companyId` in `where` (often via `findFirst({ where: { id, companyId } })`).
 */

/** Throws if companyId is missing (call from authenticated tenant flows). */
export function enforceTenantCompanyId(companyId: string | null | undefined): asserts companyId is string {
  if (!companyId) {
    const e = new Error('Tenant isolation: companyId required');
    (e as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 403;
    throw e;
  }
}

/**
 * Merge `companyId` into a `where` object for `findFirst` / `updateMany` / `deleteMany`.
 * Prefer this over ad-hoc spreads so tenant rules stay consistent.
 */
export function enforceTenant<T extends Record<string, unknown>>(where: T, companyId: string): T & { companyId: string } {
  enforceTenantCompanyId(companyId);
  return { ...where, companyId };
}
