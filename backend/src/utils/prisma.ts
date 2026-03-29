import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { getTenantContext } from './tenantContext';

// Explicit __dirname-relative path so DATABASE_URL is found regardless of process.cwd().
// In compiled dist/utils/prisma.js: ../../.env resolves to backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

const TENANT_ISOLATION_ERROR = 'Tenant isolation violation: companyId missing';

// Best-effort tenant isolation: automatically scopes "where" clauses by companyId
// for multi-record queries. This avoids hand-editing every query while keeping
// existing logic mostly intact.
const TENANT_MODELS = new Set<string>([
  'User',
  'Branch',
  'Supplier',
  'Customer',
  'Inventory',
  'StockMovement',
  'Transfer',
  'Purchase',
  'Sale',
  'Repair',
  'RefurbishJob',
  'StockAlert',
  'FileUpload',
  'DeviceHistory',
  'InventoryPart',
  'Expense',
  'Payment',
  'ProfitReport',
  'AIAlert',
  'IntegrationLog',
  'ApiKey',
  'Webhook',
  'Subscription',
  'CompanySettings',
  'BarcodeSequence',
  'MarketplaceInstall',
]);

/** True if `where` constrains `companyId` (directly or under AND/OR/NOT/nested relation filters). */
export function whereContainsCompanyId(where: unknown): boolean {
  if (where === null || where === undefined || typeof where !== 'object') return false;
  const w = where as Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(w, 'companyId')) {
    return true;
  }

  if (Array.isArray(w.AND)) {
    for (const clause of w.AND) {
      if (whereContainsCompanyId(clause)) return true;
    }
  }
  if (Array.isArray(w.OR)) {
    for (const clause of w.OR) {
      if (whereContainsCompanyId(clause)) return true;
    }
  }
  if (w.NOT !== undefined && w.NOT !== null && typeof w.NOT === 'object') {
    if (whereContainsCompanyId(w.NOT)) return true;
  }

  for (const [k, v] of Object.entries(w)) {
    if (k === 'AND' || k === 'OR' || k === 'NOT' || k === 'companyId') continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if (whereContainsCompanyId(v)) return true;
    }
  }
  return false;
}

function mergeTenantWhere(existing: unknown, companyId: string): { AND: unknown[] } {
  return { AND: [existing || {}, { companyId }] };
}

prisma.$use(async (params, next) => {
  const ctx = getTenantContext();
  // Platform super-admin: no automatic companyId merge / enforcement (cross-tenant safe by role gate in routes).
  if (ctx?.isSystemAdmin) return next(params);

  if (!params.model || !TENANT_MODELS.has(params.model)) return next(params);

  const action = params.action;
  const args = (params.args || {}) as Record<string, unknown>;

  // Hard safety: findFirst / findMany / updateMany / deleteMany must include companyId in where
  // (either from AsyncLocalStorage tenant context merge, or explicit in query when no context).
  const hardScopeActions = new Set(['findFirst', 'findMany', 'updateMany', 'deleteMany']);
  if (hardScopeActions.has(action)) {
    if (ctx?.companyId) {
      args.where = mergeTenantWhere(args.where, ctx.companyId);
      params.args = args;
    } else {
      // ✅ Allow login/register (User model without tenant)
      if (params.model === 'User') {
        return next(params);
      }
  
      if (!whereContainsCompanyId(args.where)) {
        const err = new Error(TENANT_ISOLATION_ERROR);
        (err as NodeJS.ErrnoException).code = 'TENANT_ISOLATION';
        throw err;
      }
    }
  } else {
    const softScopeActions = new Set(['count', 'aggregate', 'groupBy']);
    if (softScopeActions.has(action) && ctx?.companyId) {
      args.where = mergeTenantWhere(args.where, ctx.companyId);
      params.args = args;
    }
  }

  // Ensure new records are always tagged with the active tenant.
  if (action === 'create' && ctx?.companyId) {
    args.data = { ...(args.data as object || {}), companyId: ctx.companyId };
    params.args = args;
    return next(params);
  }

  if (action === 'createMany' && ctx?.companyId) {
    const data = args.data as unknown;
    if (Array.isArray(data)) {
      args.data = data.map((d: any) => ({ ...(d || {}), companyId: ctx.companyId }));
    } else if (data) {
      args.data = { ...(data as object), companyId: ctx.companyId };
    }
    params.args = args;
    return next(params);
  }

  return next(params);
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
