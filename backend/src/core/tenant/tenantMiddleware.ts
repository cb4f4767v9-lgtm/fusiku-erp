import type { Prisma, PrismaClient } from '@prisma/client';
import { getTenantContext } from '../../utils/tenantContext';
import { applyBranchScope } from '../../utils/branchScope';
import { BRANCH_SCOPED_MODELS, TENANT_MODELS } from '../../infrastructure/db/tenantModels';

function mergeCompany(where: Record<string, unknown> | undefined, companyId: string) {
  return { AND: [where || {}, { companyId }] };
}

const WHERE_FILTER_ACTIONS = new Set<string>([
  // reads
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  // mutations (where filter supported)
  'updateMany',
  'deleteMany',
]);

function shouldApplyWhereFilter(action: string): boolean {
  return WHERE_FILTER_ACTIONS.has(action);
}

function normalizeArgs(params: Prisma.MiddlewareParams): { args: any; action: string } {
  const action = params.action || 'unknown';
  const args: any = params.args || {};
  return { args, action };
}

/**
 * Prisma `$use` middleware: enforces tenant `companyId` on all tenant-scoped models.
 * - Throws if authenticated context has no `companyId` (unless platform system admin).
 * - Merges `companyId` into `where` for reads/updates/deletes.
 * - Injects `companyId` on creates.
 * - Applies branch scoping via `applyBranchScope` for branch-isolated models.
 *
 * Register once: `prisma.$use(tenantIsolationMiddleware)`.
 */
export const tenantIsolationMiddleware: Prisma.Middleware = async (params, next) => {
  const ctx = getTenantContext();
  const internal = (params as any).__tenantIsolationInternal === true;

  if (!params.model || !TENANT_MODELS.has(params.model)) {
    return next(params);
  }

  const { args, action } = normalizeArgs(params);

  if (!ctx?.companyId && !ctx?.isSystemAdmin) {
    throw new Error('Tenant isolation: companyId missing');
  }

  const companyId = ctx?.companyId;

  if (ctx?.isSystemAdmin && !companyId) {
    return next(params);
  }

  // ---------- WHERE scoping (safe actions only) ----------
  if (companyId && args.where && shouldApplyWhereFilter(action)) {
    args.where = mergeCompany(args.where, companyId);
  }

  if (params.model && BRANCH_SCOPED_MODELS.has(params.model) && args.where && shouldApplyWhereFilter(action)) {
    args.where = applyBranchScope(ctx || {}, args.where);
  }

  if (action === 'create' && args.data && companyId) {
    args.data = { ...args.data, companyId };
  }

  if (action === 'createMany' && args.data && companyId) {
    if (Array.isArray(args.data)) {
      args.data = args.data.map((d: any) => ({
        ...d,
        companyId,
      }));
    } else {
      args.data = { ...args.data, companyId };
    }
  }

  // Persist any direct arg edits above.
  params.args = args;

  // ---------- Special handling: operations that can bypass tenant scope ----------
  // Prisma `findUnique` / `update` / `delete` / `upsert` do not accept an `AND`-merged where clause.
  // To keep strict isolation without breaking call-sites, we emulate them via a tenant-scoped lookup.
  if (!companyId) {
    return next(params);
  }

  if (internal) {
    return next(params);
  }

  if (action === 'findUnique' || action === 'findUniqueOrThrow') {
    const scoped: Prisma.MiddlewareParams = {
      ...params,
      action: action === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst',
      args: {
        ...(args || {}),
        where: applyBranchScope(ctx || {}, mergeCompany(args.where || {}, companyId)),
      },
    };
    return next({ ...(scoped as any), __tenantIsolationInternal: true } as any);
  }

  if (action === 'update') {
    // 1) tenant-scoped existence check, 2) update by id (or original unique) to preserve return type.
    const existing: any = await next({
      ...params,
      action: 'findFirstOrThrow',
      args: {
        where: applyBranchScope(ctx || {}, mergeCompany(args.where || {}, companyId)),
        select: { id: true },
      },
      __tenantIsolationInternal: true,
    } as any);
    return next({
      ...params,
      action: 'update',
      args: { ...args, where: { id: existing.id } },
      __tenantIsolationInternal: true,
    } as any);
  }

  if (action === 'delete') {
    const existing: any = await next({
      ...params,
      action: 'findFirstOrThrow',
      args: {
        where: applyBranchScope(ctx || {}, mergeCompany(args.where || {}, companyId)),
        select: { id: true },
      },
      __tenantIsolationInternal: true,
    } as any);
    return next({
      ...params,
      action: 'delete',
      args: { ...args, where: { id: existing.id } },
      __tenantIsolationInternal: true,
    } as any);
  }

  if (action === 'upsert') {
    const existing: any = await next({
      ...params,
      action: 'findFirst',
      args: {
        where: applyBranchScope(ctx || {}, mergeCompany(args.where || {}, companyId)),
        select: { id: true },
      },
      __tenantIsolationInternal: true,
    } as any);

    if (existing?.id) {
      return next({
        ...params,
        action: 'update',
        args: {
          where: { id: existing.id },
          data: args.update,
        },
        __tenantIsolationInternal: true,
      } as any);
    }

    return next({
      ...params,
      action: 'create',
      args: {
        data: { ...(args.create || {}), companyId },
      },
      __tenantIsolationInternal: true,
    } as any);
  }

  return next(params);
};

/** @internal Attach middleware to a PrismaClient (used from `infrastructure/db/client.ts`). */
export function registerTenantMiddleware(client: PrismaClient): void {
  client.$use(tenantIsolationMiddleware);
}
