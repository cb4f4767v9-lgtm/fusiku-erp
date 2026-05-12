import { prisma } from '../utils/prisma';
import { getTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import { currencyService } from './currency.service';
import {
  amountToUsdWithStoredRate,
  inventoryLedgerCostUsd,
  normalizeAndValidateCurrencyForLedger,
  normalizeCurrencyCode,
  resolveTransactionFxRate,
  roundUsd,
  usdToTransactionCurrencyStrict
} from '../utils/financialUsd';
import { roundMoney, safeAdd, sumMoney } from '../utils/money';
import { applyBranchScope, enforceBranchWrite } from '../utils/branchScope';
import { auditLogService } from './auditLog.service';

type PricingMethod = 'FIFO' | 'LIFO' | 'CURRENT';

function normalizePricingMethod(v: unknown): PricingMethod {
  const x = String(v || '').trim().toUpperCase();
  if (x === 'LIFO' || x === 'CURRENT') return x;
  return 'FIFO';
}

async function sumRefurbCostUsdByImei(companyId: string, imeis: string[]): Promise<Map<string, number>> {
  if (!imeis.length) return new Map();
  const rows = await prisma.refurbishJob.findMany({
    where: { companyId, incomingDevice: { in: imeis }, status: 'completed' } as any,
    select: { incomingDevice: true, laborCost: true } as any
  });
  const m = new Map<string, number>();
  for (const r of rows as any[]) {
    const key = String(r.incomingDevice || '').trim();
    if (!key) continue;
    m.set(key, safeAdd(m.get(key) ?? 0, Number(r.laborCost || 0)));
  }
  return m;
}

function computeInvoiceStatus(totalDue: number, amountPaid: number): 'unpaid' | 'partial' | 'paid' {
  const due = Number(totalDue || 0);
  const paid = Number(amountPaid || 0);
  if (paid <= 0) return 'unpaid';
  if (paid + 1e-6 >= due) return 'paid';
  return 'partial';
}

export const invoiceService = {
  async list(params?: { branchId?: string; status?: string; q?: string; take?: number; skip?: number }) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const limit = Math.min(100, Math.max(1, Number(params?.take ?? 50)));
    const skip = Math.max(0, Number(params?.skip ?? 0));
    const page = Math.floor(skip / limit) + 1;
    const q = String(params?.q ?? '').trim();

    const where = applyBranchScope(ctx || {}, {
      companyId,
      ...(params?.branchId ? { branchId: params.branchId } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q, mode: 'insensitive' } } as any,
              { customer: { name: { contains: q, mode: 'insensitive' } } } as any,
            ],
          }
        : {}),
    } as any) as any;

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          companyId: true,
          branchId: true,
          customerId: true,
          currency: true,
          exchangeRateAtTransaction: true,
          subtotal: true,
          discountPercent: true,
          totalAmount: true,
          totalAmountUsd: true,
          amountPaid: true,
          amountPaidUsd: true,
          profit: true,
          profitUsd: true,
          status: true,
          notes: true,
          saleId: true,
          salesOrderId: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { id: true, name: true, phone: true } } as any,
          branch: { select: { id: true, name: true } } as any,
        } as any,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: { total, page, limit },
    };
  },

  async getById(id: string) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    return prisma.invoice.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      include: { items: true, payments: true, customer: true, branch: true, salesOrder: true, sale: true },
    });
  },

  async createFromInventory(data: {
    branchId: string;
    customerId?: string;
    items: Array<{ inventoryId: string }>;
    notes?: string;
    discountPercent?: number;
    userId?: string;
    currency?: string;
    /** Optional: link to legacy `Sale` created by POS. */
    saleId?: string;
  }, opts?: { tx?: any }) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const db = opts?.tx ?? prisma;

    enforceBranchWrite(ctx || {}, { branchId: data.branchId });
    const effectiveBranchId =
      (ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
        ? data.branchId
        : (ctx?.branchId as string | undefined) || data.branchId;

    const branch = await db.branch.findFirst({ where: { id: effectiveBranchId, companyId } });
    if (!branch) throw new Error('Branch not found');

    type InvForInvoice = {
      id: string;
      imei: string;
      status: string;
      sellingPrice: number;
      purchasePrice: number;
      costUsd: number | null;
      purchaseCurrency: string | null;
      originalCost: number | null;
      originalCurrency: string | null;
      isLegacyCost: boolean | null;
      createdAt: Date;
    };

    const inv = (await db.inventory.findMany({
      where: {
        id: { in: data.items.map((i) => i.inventoryId) },
        companyId,
        branchId: effectiveBranchId,
        status: 'available',
      },
      select: {
        id: true,
        imei: true,
        status: true,
        sellingPrice: true,
        purchasePrice: true,
        costUsd: true,
        purchaseCurrency: true,
        originalCost: true,
        originalCurrency: true,
        isLegacyCost: true,
        createdAt: true,
      } as any,
    })) as unknown as InvForInvoice[];

    if (inv.length !== data.items.length) {
      throw new Error('Some items are not available at this branch');
    }

    // Re-check inventory availability before creating invoice.
    if (inv.some((i) => i.status !== 'available')) {
      throw new Error('Some items already sold');
    }

    const settings = await db.companySettings.findFirst({ where: { companyId } });
    const pricingMethodUsed = normalizePricingMethod((settings as any)?.pricingMethod);

    const currency = normalizeAndValidateCurrencyForLedger(data.currency);
    const rates = await currencyService.getRatesMap(companyId);
    const exchangeRateAtTransaction = resolveTransactionFxRate(currency, rates);

    const orderIndex = new Map(data.items.map((x, i) => [x.inventoryId, i]));
    const sortedInv =
      pricingMethodUsed === 'CURRENT'
        ? [...inv].sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
        : pricingMethodUsed === 'LIFO'
          ? [...inv].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          : [...inv].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const subtotal = sumMoney(sortedInv.map((i) => Number(i.sellingPrice)));
    if (subtotal <= 0) throw new Error('Invoice subtotal invalid: selling prices must sum to a positive amount.');

    const discountPercent = Math.min(100, Math.max(0, data.discountPercent || 0));
    const totalAmount = roundMoney(subtotal * (1 - discountPercent / 100), 6);

    // Optional refurb cost: sums completed refurb jobs by IMEI (laborCost treated as USD).
    const refurbUsdByImei = await sumRefurbCostUsdByImei(companyId, sortedInv.map((i) => i.imei));

    let allocatedSub = 0;
    const itemsPayload: Array<any> = [];
    for (let idx = 0; idx < sortedInv.length; idx++) {
      const item = sortedInv[idx];
      const isLast = idx === sortedInv.length - 1;
      const sp = Number(item.sellingPrice);
      const lineNetTxn = isLast
        ? roundMoney(totalAmount - allocatedSub, 6)
        : roundMoney(totalAmount * (sp / subtotal), 6);
      allocatedSub = safeAdd(allocatedSub, lineNetTxn);

      const ledger = inventoryLedgerCostUsd({
        costUsd: item.costUsd as number | null | undefined,
        purchasePrice: Number(item.purchasePrice),
        isLegacyCost: item.isLegacyCost as boolean | null | undefined,
      });
      const costUsdUsed = ledger.value;
      const refurbCostUsdUsed = roundUsd(Number(refurbUsdByImei.get(item.imei) ?? 0));

      const revenueUsd = amountToUsdWithStoredRate(lineNetTxn, currency, exchangeRateAtTransaction);
      const profitUsd = roundUsd(revenueUsd - costUsdUsed - refurbCostUsdUsed);

      const costTxn = usdToTransactionCurrencyStrict(costUsdUsed + refurbCostUsdUsed, currency, exchangeRateAtTransaction);
      const profitTxn = roundMoney(lineNetTxn - costTxn, 6);

      itemsPayload.push({
        inventoryId: item.id,
        imei: item.imei,
        quantity: 1,
        costPrice: costTxn,
        salePrice: lineNetTxn,
        profit: profitTxn,
        costUsdUsed,
        revenueUsd,
        profitUsd,
        refurbCostUsdUsed,
        description: `${item.imei}`,
      });
    }

    const totalAmountUsd = roundUsd(sumMoney(itemsPayload.map((x) => Number(x.revenueUsd || 0))));
    const profitUsd = roundUsd(sumMoney(itemsPayload.map((x) => Number(x.profitUsd || 0))));
    const profit = sumMoney(itemsPayload.map((x) => Number(x.profit || 0)));

    const run = async (tx: any) => {
      const created = await tx.invoice.create({
        data: {
          companyId,
          branchId: effectiveBranchId,
          customerId: data.customerId,
          saleId: data.saleId,
          currency,
          exchangeRateAtTransaction,
          subtotal,
          discountPercent,
          totalAmount,
          totalAmountUsd,
          amountPaid: 0,
          amountPaidUsd: 0,
          profit,
          profitUsd,
          status: 'unpaid',
          notes: data.notes,
          createdById: data.userId,
          items: { create: itemsPayload as any },
        } as any,
        include: { items: true },
      });

      for (const it of sortedInv) {
        const fresh = await tx.inventory.findUnique({
          where: { id: it.id },
          select: { id: true, status: true },
        });
        if (!fresh || String((fresh as any).status) !== 'available') {
          throw new Error('Some items already sold');
        }
        try {
          await tx.inventory.update({
            where: { id: it.id },
            data: { status: 'sold' },
          });
        } catch {
          throw new Error(`Inventory ${it.id} was not available for invoice (already sold or missing).`);
        }
      }

      return created;
    };

    const invoice = opts?.tx ? await run(opts.tx) : await prisma.$transaction(run);

    const createdInvoice = await db.invoice.findFirst({
      where: applyBranchScope(ctx || {}, { id: invoice.id, companyId } as any),
      include: { items: true, customer: true, branch: true },
    });
    if (createdInvoice) {
      await auditLogService.log({
        action: 'invoice_create',
        entity: 'Invoice',
        entityId: createdInvoice.id,
        branchId: createdInvoice.branchId,
        metadata: {
          totalAmount: createdInvoice.totalAmount,
          totalAmountUsd: createdInvoice.totalAmountUsd,
          profit: createdInvoice.profit,
          currency: createdInvoice.currency,
          saleId: createdInvoice.saleId ?? null,
        },
      });
    }
    return createdInvoice;
  },

  async addPayment(invoiceId: string, data: { amount: number; method?: string; reference?: string; paidAt?: Date }) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const inv = await prisma.invoice.findFirst({ where: applyBranchScope(ctx || {}, { id: invoiceId, companyId } as any) });
    if (!inv) throw new Error('Invoice not found');

    const currency = normalizeAndValidateCurrencyForLedger(inv.currency);
    const rates = await currencyService.getRatesMap(companyId);
    const fx = inv.exchangeRateAtTransaction ?? resolveTransactionFxRate(currency, rates);

    const amount = Number(data.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be > 0');

    const amountUsd = amountToUsdWithStoredRate(amount, currency, fx);

    const payment = await prisma.payment.create({
      data: {
        companyId,
        invoiceId: inv.id,
        branchId: inv.branchId,
        customerId: inv.customerId,
        amount,
        currency,
        amountUsd,
        exchangeRateAtTransaction: fx,
        method: data.method || 'cash',
        reference: data.reference,
        paidAt: data.paidAt || new Date(),
        status: 'completed',
      } as any,
    });

    // Recompute paid + status.
    const payments = await prisma.payment.findMany({
      where: applyBranchScope(ctx || {}, { companyId, invoiceId: inv.id, status: 'completed' } as any) as any
    });
    const amountPaid = roundMoney(sumMoney(payments.map((p: any) => Number(p.amount || 0))), 6);
    const amountPaidUsd = roundUsd(sumMoney(payments.map((p: any) => Number(p.amountUsd || 0))));

    if (amountPaid > Number(inv.totalAmount || 0)) {
      throw new Error('Overpayment not allowed');
    }

    const status = computeInvoiceStatus(Number(inv.totalAmount || 0), amountPaid);

    await prisma.invoice.updateMany({
      where: applyBranchScope(ctx || {}, { id: inv.id, companyId } as any) as any,
      data: { amountPaid, amountPaidUsd, status } as any,
    });

    await auditLogService.log({
      action: 'invoice_payment_add',
      entity: 'Payment',
      entityId: payment.id,
      branchId: inv.branchId,
      metadata: {
        invoiceId: inv.id,
        amount,
        currency,
        status,
      },
    });

    return { payment, status, amountPaid, amountPaidUsd };
  },
};

