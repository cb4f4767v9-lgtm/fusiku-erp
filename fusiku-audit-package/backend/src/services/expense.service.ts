import { prisma } from '../utils/prisma';
import { getTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { assertBranchQueryAllowed } from '../utils/branchAccess';
import { applyBranchScope, enforceBranchWrite } from '../utils/branchScope';
import {
  amountToUsdStrict,
  effectiveExpenseUsd,
  normalizeAndValidateCurrencyForLedger,
  resolveTransactionFxRate,
  type ExpenseBranchUsdRow
} from '../utils/financialUsd';
import { currencyService } from './currency.service';

export const EXPENSE_CATEGORIES = ['rent', 'salary', 'cargo', 'misc'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const LEGACY_CATEGORIES = new Set([
  'utilities',
  'parts',
  'labor',
  'shipping',
  'other',
  ...EXPENSE_CATEGORIES
]);

function normalizeCategory(raw: string): string {
  const c = (raw || '').trim().toLowerCase();
  if (LEGACY_CATEGORIES.has(c)) return c;
  return 'misc';
}

export const expenseService = {
  normalizeCategory,

  async assertBranchInCompany(branchId: string) {
    const companyId = requireTenantCompanyId();
    const b = await prisma.branch.findFirst({
      where: { id: branchId, companyId, isActive: true },
      select: { id: true }
    });
    if (!b) {
      const e = new Error('Invalid branch for this company.');
      (e as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 400;
      throw e;
    }
  },

  async create(input: {
    category: string;
    amount: number;
    branchId: string;
    expenseDate: Date;
    description?: string | null;
    currency?: string;
  }) {
    const ctx = getTenantContext();
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const e = new Error('Amount must be a positive number.');
      (e as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 400;
      throw e;
    }
    enforceBranchWrite(ctx || {}, { branchId: input.branchId });
    const effectiveBranchId =
      (ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
        ? input.branchId
        : (ctx?.branchId as string | undefined) || input.branchId;

    await this.assertBranchInCompany(effectiveBranchId);
    const category = normalizeCategory(input.category);
    const companyId = requireTenantCompanyId();
    const currency = normalizeAndValidateCurrencyForLedger(input.currency || 'USD');
    const rates = await currencyService.getRatesMap(companyId);
    const exchangeRateAtTransaction = resolveTransactionFxRate(currency, rates);
    const amountUsd = amountToUsdStrict(amount, currency, rates);
    return prisma.expense.create({
      data: {
        companyId,
        branchId: effectiveBranchId,
        category,
        amount,
        amountUsd,
        exchangeRateAtTransaction,
        expenseDate: input.expenseDate,
        description: input.description?.trim() || null,
        currency
      } as any,
      include: { branch: { select: { id: true, name: true } } }
    });
  },

  async createFromHttpBody(user: AuthRequest['user'], body: Record<string, unknown>) {
    const b = body || {};
    const branchId = assertBranchQueryAllowed(user, b.branchId as string);
    if (!branchId) {
      const e = new Error('branchId is required.');
      (e as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 400;
      throw e;
    }
    const expenseDate = b.expenseDate ? new Date(String(b.expenseDate)) : new Date();
    if (Number.isNaN(expenseDate.getTime())) {
      const e = new Error('Invalid expenseDate.');
      (e as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 400;
      throw e;
    }
    return expenseService.create({
      category: String(b.category || 'misc'),
      amount: Number(b.amount),
      branchId,
      expenseDate,
      description: b.description != null ? String(b.description) : undefined,
      currency: b.currency != null ? String(b.currency) : undefined
    });
  },

  async list(filters: { branchId?: string; month?: string; startDate?: Date; endDate?: Date }) {
    const ctx = getTenantContext();
    const where: Record<string, unknown> = {};
    if (ctx?.companyId) {
      where.companyId = ctx.companyId;
    } else if (!ctx?.isSystemAdmin) {
      where.companyId = requireTenantCompanyId();
    }
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      const [y, m] = filters.month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      where.expenseDate = { gte: start, lte: end };
    } else {
      if (filters.startDate || filters.endDate) {
        where.expenseDate = {} as Record<string, Date>;
        if (filters.startDate) (where.expenseDate as any).gte = filters.startDate;
        if (filters.endDate) (where.expenseDate as any).lte = filters.endDate;
      }
    }
    return prisma.expense.findMany({
      where: applyBranchScope(ctx || {}, where as any) as any,
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { expenseDate: 'desc' }
    });
  },

  /** Sum of expenses in range, grouped by branchId (null bucket for unassigned). */
  async sumByBranchInRange(start: Date, end: Date, restrictBranchId?: string) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const where: Record<string, unknown> = {
      companyId,
      expenseDate: { gte: start, lte: end }
    };
    if (restrictBranchId) where.branchId = restrictBranchId;
    const rates = await currencyService.getRatesMap(companyId);
    const rows = await prisma.expense.findMany({
      where: applyBranchScope(ctx || {}, where as any) as any,
      select: {
        branchId: true,
        amount: true,
        amountUsd: true,
        currency: true,
        exchangeRateAtTransaction: true
      } as any
    });
    const byBranch = new Map<string | null, number>();
    for (const r of rows as unknown as ExpenseBranchUsdRow[]) {
      const u = effectiveExpenseUsd(r, rates);
      byBranch.set(r.branchId, (byBranch.get(r.branchId) ?? 0) + u);
    }
    return [...byBranch.entries()].map(([branchId, totalExpenses]) => ({
      branchId,
      totalExpenses
    }));
  }
};
