import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { webhookService } from './webhook.service';
import { requireTenantCompanyId } from '../utils/tenantContext';
import {
  amountToUsdWithStoredRate,
  inventoryLedgerCostUsd,
  normalizeAndValidateCurrencyForLedger,
  normalizeCurrencyCode,
  resolveTransactionFxRate,
  roundUsd,
  usdToTransactionCurrencyStrict
} from '../utils/financialUsd';
import { currentPricingInventoryCostUsd } from '../utils/currentPricingCostUsd';
import { currencyService } from './currency.service';
import { roundMoney, safeAdd, sumMoney } from '../utils/money';
import { syncCompanyUsage } from './companyUsage.service';
import { auditLogService } from './auditLog.service';

type PricingMethod = 'FIFO' | 'LIFO' | 'CURRENT';

function normalizePricingMethod(v: unknown): PricingMethod {
  const x = String(v || '').trim().toUpperCase();
  if (x === 'LIFO' || x === 'CURRENT') return x;
  return 'FIFO';
}

export const posService = {
  async createSale(data: {
    branchId: string;
    customerId?: string;
    items: Array<{ inventoryId: string }>;
    paymentMethod?: string;
    notes?: string;
    discountPercent?: number;
    userId?: string;
    /** ISO currency of totals; defaults USD */
    currency?: string;
  }) {
    const companyId = requireTenantCompanyId();

    const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId } });
    if (!branch) throw new Error('Branch not found');

    type InvForSale = {
      id: string;
      imei: string;
      sellingPrice: number;
      purchasePrice: number;
      costUsd: number | null;
      purchaseCurrency: string | null;
      exchangeRateAtPurchase: number | null;
      originalCost: number | null;
      originalCurrency: string | null;
      isLegacyCost: boolean | null;
      createdAt: Date;
    };
    const items = (await prisma.inventory.findMany({
      where: {
        id: { in: data.items.map((i) => i.inventoryId) },
        companyId,
        branchId: data.branchId,
        status: 'available'
      },
      select: {
        id: true,
        imei: true,
        sellingPrice: true,
        purchasePrice: true,
        costUsd: true,
        purchaseCurrency: true,
        exchangeRateAtPurchase: true,
        originalCost: true,
        originalCurrency: true,
        isLegacyCost: true,
        createdAt: true
      } as any
    })) as unknown as InvForSale[];

    if (items.length !== data.items.length) {
      throw new Error('Some items are not available at this branch');
    }

    const settings = await prisma.companySettings.findFirst({ where: { companyId } });
    const pricingMethodUsed = normalizePricingMethod((settings as any)?.pricingMethod);

    const currency = normalizeAndValidateCurrencyForLedger(data.currency);
    const rates = await currencyService.getRatesMap(companyId);
    const exchangeRateAtTransaction = resolveTransactionFxRate(currency, rates);

    const orderIndex = new Map(data.items.map((x, i) => [x.inventoryId, i]));
    const invCostCurrencies = [
      ...new Set(
        items.map((i) => normalizeCurrencyCode(i.originalCurrency ?? i.purchaseCurrency ?? 'USD'))
      )
    ];
    const currencyRows =
      pricingMethodUsed === 'CURRENT'
        ? await prisma.currency.findMany({
            where: { companyId, code: { in: invCostCurrencies } } as any,
            select: { code: true, marketPrice: true } as any
          })
        : [];
    const marketUnitsByCode = new Map<string, number | null>(
      (currencyRows as any[]).map((r) => [String(r.code || '').toUpperCase(), Number(r.marketPrice)])
    );

    /** FIFO/LIFO: sort by `createdAt`. CURRENT: preserve cart order (no FIFO/LIFO for cost policy). */
    const sortedItems =
      pricingMethodUsed === 'CURRENT'
        ? [...items].sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
        : pricingMethodUsed === 'LIFO'
          ? [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          : [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const subtotal = sumMoney(sortedItems.map((i) => Number(i.sellingPrice)));
    if (subtotal <= 0) {
      throw new Error('Sale subtotal invalid: selling prices must sum to a positive amount.');
    }

    const discountPercent = Math.min(100, Math.max(0, data.discountPercent || 0));
    const totalAmount = roundMoney(subtotal * (1 - discountPercent / 100), 6);

    let allocatedSub = 0;
    const saleItemsPayload: Array<{
      inventoryId: string;
      imei: string;
      sellingPrice: number;
      purchasePrice: number;
      profit: number;
      costUsdUsed: number;
      revenueUsd: number;
      profitUsd: number;
      pricingMethodUsed: PricingMethod;
    }> = [];

    for (let idx = 0; idx < sortedItems.length; idx++) {
      const item = sortedItems[idx];
      const isLast = idx === sortedItems.length - 1;
      const sp = Number(item.sellingPrice);
      const lineNetTxn = isLast
        ? roundMoney(totalAmount - allocatedSub, 6)
        : roundMoney(totalAmount * (sp / subtotal), 6);
      allocatedSub = safeAdd(allocatedSub, lineNetTxn);

      let costUsdUsed: number;
      if (pricingMethodUsed === 'CURRENT') {
        const invCcy = normalizeCurrencyCode(item.originalCurrency ?? item.purchaseCurrency ?? 'USD');
        const mp = marketUnitsByCode.get(invCcy);
        const marketUnits =
          mp != null && Number.isFinite(Number(mp)) && Number(mp) > 0 ? Number(mp) : null;
        costUsdUsed = currentPricingInventoryCostUsd({
          purchaseLocal: Number(item.purchasePrice),
          purchaseCurrency: item.purchaseCurrency,
          originalLocal: item.originalCost != null ? Number(item.originalCost) : null,
          originalCurrency: item.originalCurrency,
          storedCostUsd: item.costUsd != null ? Number(item.costUsd) : null,
          rates,
          marketUnitsPerUsd: marketUnits
        });
      } else {
        const ledger = inventoryLedgerCostUsd({
          costUsd: item.costUsd as number | null | undefined,
          purchasePrice: Number(item.purchasePrice),
          isLegacyCost: item.isLegacyCost as boolean | null | undefined
        });
        costUsdUsed = ledger.value;
      }

      const revenueUsd = amountToUsdWithStoredRate(lineNetTxn, currency, exchangeRateAtTransaction);
      const profitUsd = roundUsd(revenueUsd - costUsdUsed);

      const purchasePriceTxn = usdToTransactionCurrencyStrict(costUsdUsed, currency, exchangeRateAtTransaction);
      const profitTxn = roundMoney(lineNetTxn - purchasePriceTxn, 6);

      saleItemsPayload.push({
        inventoryId: item.id,
        imei: item.imei,
        sellingPrice: sp,
        purchasePrice: purchasePriceTxn,
        profit: profitTxn,
        costUsdUsed,
        revenueUsd,
        profitUsd,
        pricingMethodUsed
      });
    }

    const totalAmountUsd = roundUsd(sumMoney(saleItemsPayload.map((s) => s.revenueUsd)));
    const profitUsd = roundUsd(sumMoney(saleItemsPayload.map((s) => s.profitUsd)));
    const profit = sumMoney(saleItemsPayload.map((s) => s.profit));

    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          companyId,
          branchId: data.branchId,
          customerId: data.customerId,
          currency,
          totalAmount,
          profit,
          totalAmountUsd,
          profitUsd,
          exchangeRateAtTransaction,
          pricingMethodUsed,
          paymentMethod: data.paymentMethod || 'cash',
          notes: data.notes,
          saleItems: {
            create: saleItemsPayload as any
          }
        } as any,
        include: { saleItems: true, branch: true }
      });

      for (const item of sortedItems) {
        const res = await tx.inventory.updateMany({
          where: { id: item.id, companyId, status: 'available' },
          data: { status: 'sold' }
        });
        if (res.count !== 1) {
          throw new Error(`Inventory ${item.id} was not available for sale (already sold or missing).`);
        }
      }

      for (const item of sortedItems) {
        await stockMovementService.create(
          {
            inventoryId: item.id,
            movementType: 'sale',
            branchId: data.branchId,
            userId: data.userId,
            referenceId: s.id,
            quantity: 1
          },
          tx
        );
      }

      for (const si of s.saleItems) {
        const warrantyStart = s.createdAt;
        const warrantyEnd = new Date(warrantyStart);
        warrantyEnd.setMonth(warrantyEnd.getMonth() + 12);

        const existing = await (tx as any).warranty.findFirst({
          where: { companyId, imei: si.imei }
        });
        if (existing) {
          const updated = await (tx as any).warranty.updateMany({
            where: { id: existing.id, companyId },
            data: { warrantyStart, warrantyEnd, saleId: s.id }
          });
          if (updated.count !== 1) throw new Error('Warranty update failed (tenant isolation)');
        } else {
          await (tx as any).warranty.create({
            data: { companyId, imei: si.imei, saleId: s.id, warrantyStart, warrantyEnd }
          });
        }
      }

      await tx.invoice.create({
        data: {
          companyId,
          branchId: data.branchId,
          customerId: data.customerId,
          saleId: s.id,
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
          items: {
            create: saleItemsPayload.map((si) => ({
              inventoryId: si.inventoryId,
              imei: si.imei,
              quantity: 1,
              costPrice: si.purchasePrice,
              salePrice: si.sellingPrice,
              profit: si.profit,
              costUsdUsed: si.costUsdUsed,
              revenueUsd: si.revenueUsd,
              profitUsd: si.profitUsd,
              description: si.imei,
            })),
          },
        } as any,
      });

      return s;
    });

    for (const item of sortedItems) {
      await imeiHistoryService.record(
        item.imei,
        'sale',
        {
          location: branch.name || data.branchId,
          userId: data.userId,
          referenceId: sale.id,
        }
      );
    }

    const result = await prisma.sale.findFirst({
      where: { id: sale.id, companyId },
      include: { saleItems: true, branch: true, customer: true }
    });

    void syncCompanyUsage(companyId).catch(() => {});
    if (result && branch.companyId) {
      webhookService.dispatch(branch.companyId, 'sale.completed', {
        saleId: result.id,
        totalAmount: Number(result.totalAmount),
        profit: Number(result.profit),
        items: result.saleItems?.map((si: any) => ({ imei: si.imei, sellingPrice: Number(si.sellingPrice) }))
      }).catch(() => {});
    }
    if (result) {
      await auditLogService.log({
        action: 'pos_sale_create',
        entity: 'Invoice',
        entityId: result.id,
        branchId: result.branchId,
        metadata: {
          totalAmount: result.totalAmount,
          totalAmountUsd: result.totalAmountUsd,
          profit: result.profit,
          itemCount: result.saleItems?.length ?? 0,
        },
      });
    }
    return result;
  },

  async getReceipt(saleId: string) {
    const companyId = requireTenantCompanyId();
    return prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: { saleItems: true, branch: true, customer: true }
    });
  }
};
