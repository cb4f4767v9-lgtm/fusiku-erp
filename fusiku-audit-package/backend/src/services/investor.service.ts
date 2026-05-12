import { requireTenantCompanyId } from '../utils/tenantContext';
import { prisma } from '../utils/prisma';
import {
  amountToUsdStrict,
  effectiveExpenseUsd,
  normalizeAndValidateCurrencyForLedger,
  resolveTransactionFxRate
} from '../utils/financialUsd';
import { investorBalanceUsd, profitShareUsd } from '../utils/investorCapital';
import { currencyService } from './currency.service';

/** Until `npx prisma generate` runs (dev server may lock the engine DLL), delegate to generated delegates. */
const db = prisma as unknown as {
  investor: any;
  investorTransaction: any;
  profitDistribution: any;
};

type InvType = 'investor' | 'lender';
type TxType = 'deposit' | 'withdrawal';

function assertInvestorType(t: string): InvType {
  const x = String(t || '').toLowerCase();
  if (x === 'investor' || x === 'lender') return x;
  throw new Error('type must be investor or lender');
}

function assertTxType(t: string): TxType {
  const x = String(t || '').toLowerCase();
  if (x === 'deposit' || x === 'withdrawal') return x;
  throw new Error('type must be deposit or withdrawal');
}

function txSignedUsd(
  row: { amount: number; amountUsd?: number | null; currency?: string | null; type: string },
  rates: Record<string, number>
): number {
  const u = effectiveExpenseUsd(
    { amount: row.amount, amountUsd: row.amountUsd, currency: row.currency },
    rates
  );
  return String(row.type).toLowerCase() === 'withdrawal' ? -u : u;
}

function txUsdAbs(
  row: { amount: number; amountUsd?: number | null; currency?: string | null; type: string },
  rates: Record<string, number>
): number {
  return effectiveExpenseUsd(
    { amount: row.amount, amountUsd: row.amountUsd, currency: row.currency },
    rates
  );
}

export const investorService = {
  async list(activeOnly = false) {
    const companyId = requireTenantCompanyId();
    return db.investor.findMany({
      where: { companyId, ...(activeOnly ? { active: true } : {}) },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { transactions: true } } }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return db.investor.findFirst({
      where: { id, companyId },
      include: { transactions: { orderBy: { date: 'desc' } } }
    });
  },

  async create(input: {
    name: string;
    type: string;
    capitalAmount?: number;
    currency?: string;
    sharePercentage?: number | null;
    startDate?: Date;
    active?: boolean;
  }) {
    const companyId = requireTenantCompanyId();
    const type = assertInvestorType(input.type);
    if (type === 'lender' && input.sharePercentage != null && Number(input.sharePercentage) > 0) {
      throw new Error('Lenders cannot have sharePercentage.');
    }
    const currency = normalizeAndValidateCurrencyForLedger(input.currency || 'USD');
    let share: number | null = null;
    if (type === 'investor' && input.sharePercentage != null && Number.isFinite(Number(input.sharePercentage))) {
      share = Math.min(100, Math.max(0, Number(input.sharePercentage)));
    }
    return db.investor.create({
      data: {
        companyId,
        name: String(input.name || '').trim() || 'Unnamed',
        type,
        capitalAmount: Number(input.capitalAmount) || 0,
        currency,
        sharePercentage: share,
        startDate: input.startDate || new Date(),
        active: input.active !== false
      } as any
    });
  },

  async createFromHttpBody(body: Record<string, unknown>) {
    const b = body || {};
    return investorService.create({
      name: String(b.name || ''),
      type: String(b.type || 'investor'),
      capitalAmount: b.capitalAmount != null ? Number(b.capitalAmount) : 0,
      currency: b.currency != null ? String(b.currency) : undefined,
      sharePercentage: b.sharePercentage != null ? Number(b.sharePercentage) : null,
      startDate: b.startDate ? new Date(String(b.startDate)) : undefined,
      active: b.active !== false
    });
  },

  async addTransaction(
    investorId: string,
    input: { type: string; amount: number; currency?: string; date?: Date }
  ) {
    const companyId = requireTenantCompanyId();
    const txType = assertTxType(input.type);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be positive');
    const rates = await currencyService.getRatesMap(companyId);
    return prisma.$transaction(async (tx) => {
      const invRow = await tx.investor.findFirst({ where: { id: investorId, companyId } });
      if (!invRow) throw new Error('Investor not found');
      const currency = normalizeAndValidateCurrencyForLedger(input.currency || invRow.currency || 'USD');
      const exchangeRateAtTransaction = resolveTransactionFxRate(currency, rates);
      const amountUsd = amountToUsdStrict(amount, currency, rates);
      return tx.investorTransaction.create({
        data: {
          companyId,
          investorId,
          type: txType,
          amount,
          currency,
          amountUsd,
          exchangeRateAtTransaction,
          date: input.date || new Date()
        } as any
      });
    });
  },

  async addTransactionFromHttpBody(investorId: string, body: Record<string, unknown>) {
    const b = body || {};
    return investorService.addTransaction(investorId, {
      type: String(b.type || ''),
      amount: Number(b.amount),
      currency: b.currency != null ? String(b.currency) : undefined,
      date: b.date ? new Date(String(b.date)) : undefined
    });
  },

  async listTransactions(investorId: string) {
    const companyId = requireTenantCompanyId();
    return db.investorTransaction.findMany({
      where: { companyId, investorId },
      orderBy: { date: 'desc' }
    });
  },

  async listProfitDistributions(investorId: string, opts?: { period?: string }) {
    const companyId = requireTenantCompanyId();
    const where: any = { companyId, investorId };
    if (opts?.period) where.period = String(opts.period);
    return db.profitDistribution.findMany({ where, orderBy: { date: 'desc' } });
  },

  async addProfitDistribution(
    investorId: string,
    input: { amountUsd: number; period: string; date?: Date }
  ) {
    const companyId = requireTenantCompanyId();
    const amountUsd = Number(input.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error('amountUsd must be positive');
    const period = String(input.period || '').trim();
    if (!period) throw new Error('period is required');
    return prisma.$transaction(async (tx) => {
      const invRow = await tx.investor.findFirst({ where: { id: investorId, companyId } });
      if (!invRow) throw new Error('Investor not found');
      return tx.profitDistribution.create({
        data: {
          companyId,
          investorId,
          amountUsd,
          period,
          date: input.date || new Date()
        } as any
      });
    });
  },

  async addProfitDistributionFromHttpBody(investorId: string, body: Record<string, unknown>) {
    const b = body || {};
    return investorService.addProfitDistribution(investorId, {
      amountUsd: Number(b.amountUsd),
      period: String(b.period || ''),
      date: b.date ? new Date(String(b.date)) : undefined
    });
  },

  /**
   * Dynamic balances (auditable):
   * - capitalUsd = Σ(depositsUsd - withdrawalsUsd) from InvestorTransaction only
   * - profitShareUsd = Σ(ProfitDistribution.amountUsd)
   * - balanceUsd = deposits - withdrawals + profitShare
   *
   * Optional period + netProfitUsd enable profit paid vs unpaid reporting.
   */
  async getFinancialReport(opts?: { period?: string; netProfitUsd?: number }) {
    const companyId = requireTenantCompanyId();
    const period = opts?.period != null && String(opts.period).trim() !== '' ? String(opts.period).trim() : null;
    const net =
      opts?.netProfitUsd != null && Number.isFinite(Number(opts.netProfitUsd)) ? Number(opts.netProfitUsd) : null;
    const rates = await currencyService.getRatesMap(companyId);

    const investors = await db.investor.findMany({
      where: { companyId, active: true },
      include: { transactions: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    const distWhere: any = { companyId };
    if (period) distWhere.period = period;
    const distributions = await db.profitDistribution.findMany({
      where: distWhere,
      select: { investorId: true, amountUsd: true, period: true, date: true } as any
    });
    const paidByInvestor = new Map<string, number>();
    for (const d of distributions) {
      paidByInvestor.set(d.investorId, (paidByInvestor.get(d.investorId) ?? 0) + Number(d.amountUsd || 0));
    }

    let totalLiabilityUsd = 0;
    let totalInvestorBalanceUsd = 0;
    let totalProfitPaidUsd = 0;
    let totalProfitExpectedUsd = 0;

    const rows = investors.map((inv: any) => {
      let depositsUsd = 0;
      let withdrawalsUsd = 0;
      for (const t of inv.transactions || []) {
        const abs = txUsdAbs(t, rates);
        if (String(t.type).toLowerCase() === 'withdrawal') withdrawalsUsd += abs;
        else depositsUsd += abs;
      }
      const capitalUsd = depositsUsd - withdrawalsUsd;
      const profitPaidUsd = Number((paidByInvestor.get(inv.id) ?? 0).toFixed(2));
      const balanceUsd = investorBalanceUsd({ depositsUsd, withdrawalsUsd, profitShareUsd: profitPaidUsd });

      const expectedProfitShare = net != null ? profitShareUsd(net, inv.type, inv.sharePercentage) : null;
      const profitUnpaidUsd =
        expectedProfitShare != null ? Number(Math.max(0, expectedProfitShare - profitPaidUsd).toFixed(2)) : null;

      if (String(inv.type).toLowerCase() === 'lender') totalLiabilityUsd += balanceUsd;
      else totalInvestorBalanceUsd += balanceUsd;

      totalProfitPaidUsd += profitPaidUsd;
      if (expectedProfitShare != null) totalProfitExpectedUsd += expectedProfitShare;

      return {
        investorId: inv.id,
        name: inv.name,
        type: inv.type,
        sharePercentage: inv.sharePercentage,
        depositsUsd: Number(depositsUsd.toFixed(2)),
        withdrawalsUsd: Number(withdrawalsUsd.toFixed(2)),
        capitalUsd: Number(capitalUsd.toFixed(2)),
        profitPaidUsd,
        balanceUsd,
        expectedProfitShareUsd: expectedProfitShare,
        profitUnpaidUsd,
        // Backward-compat fields for legacy UI/debug (not used in calculations)
        legacyCapitalAmount: inv.capitalAmount,
        legacyCapitalCurrency: inv.currency
      };
    });

    return {
      period,
      netProfitUsdUsed: net,
      investors: rows,
      totals: {
        totalLiabilityUsd: Number(totalLiabilityUsd.toFixed(2)),
        totalInvestorBalanceUsd: Number(totalInvestorBalanceUsd.toFixed(2)),
        profitPaidUsd: Number(totalProfitPaidUsd.toFixed(2)),
        profitExpectedUsd: net != null ? Number(totalProfitExpectedUsd.toFixed(2)) : null,
        profitUnpaidUsd:
          net != null ? Number(Math.max(0, totalProfitExpectedUsd - totalProfitPaidUsd).toFixed(2)) : null
      }
    };
  },

  /**
   * Capital snapshot: committed principal (converted to USD) plus signed cash flows per party.
   * `netProfitUsd` optional — drives profit distribution preview for investors only.
   */
  async getCapitalSummary(opts?: { netProfitUsd?: number }) {
    const companyId = requireTenantCompanyId();
    const rates = await currencyService.getRatesMap(companyId);
    const [investors, settings] = await Promise.all([
      db.investor.findMany({
        where: { companyId, active: true },
        include: { transactions: true }
      }),
      prisma.companySettings.findFirst({ where: { companyId } })
    ]);

    let totalInvestorCapitalUsd = 0;
    let totalBorrowedFundsUsd = 0;

    for (const inv of investors) {
      // Dynamic capital per spec: rely on transactions only (auditable)
      let depositsUsd = 0;
      let withdrawalsUsd = 0;
      for (const t of inv.transactions) {
        const abs = txUsdAbs(t, rates);
        if (String(t.type).toLowerCase() === 'withdrawal') withdrawalsUsd += abs;
        else depositsUsd += abs;
      }
      const total = depositsUsd - withdrawalsUsd;
      if (String(inv.type).toLowerCase() === 'lender') {
        totalBorrowedFundsUsd += total;
      } else {
        totalInvestorCapitalUsd += total;
      }
    }

    const net =
      opts?.netProfitUsd != null && Number.isFinite(Number(opts.netProfitUsd)) ? Number(opts.netProfitUsd) : 0;
    const profitDistribution = investors
      .filter((i) => String(i.type).toLowerCase() === 'investor')
      .map((i) => ({
        investorId: i.id,
        name: i.name,
        type: i.type,
        sharePercentage: i.sharePercentage,
        profitShareUsd: profitShareUsd(net, i.type, i.sharePercentage)
      }));

    const eq = (settings as { companyEquityUsd?: number | null } | null)?.companyEquityUsd;

    return {
      totalInvestorCapitalUsd: Number(totalInvestorCapitalUsd.toFixed(2)),
      totalBorrowedFundsUsd: Number(totalBorrowedFundsUsd.toFixed(2)),
      companyEquityUsd:
        eq != null && Number.isFinite(Number(eq)) ? Number(Number(eq).toFixed(2)) : null,
      netProfitUsdUsed: net,
      profitDistribution
    };
  }
};
