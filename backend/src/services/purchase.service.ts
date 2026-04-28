import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { getTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import { amountToUsdStrict, normalizeAndValidateCurrencyForLedger, resolveTransactionFxRate } from '../utils/financialUsd';
import { currencyService } from './currency.service';
import { roundMoney, safeAdd } from '../utils/money';
import { applyBranchScope, enforceBranchWrite } from '../utils/branchScope';

async function getNextBarcode(companyId: string, tx?: Prisma.TransactionClient): Promise<string> {
  const db = tx ?? prisma;
  const seq = await db.barcodeSequence.upsert({
    where: { companyId },
    create: { companyId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return 'FUS' + String(seq.lastNumber).padStart(8, '0');
}

function syntheticUnitId(prefix: string) {
  return `${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`;
}

const PRODUCT_TYPES = new Set(['phone', 'part', 'accessory']);

function normalizeProductType(raw: unknown): 'phone' | 'part' | 'accessory' {
  const v = String(raw ?? 'phone')
    .trim()
    .toLowerCase();
  if (v === 'part' || v === 'accessory' || v === 'phone') return v;
  return 'phone';
}

/** Business condition: new | used | refurbished */
function normalizeCondition(raw: unknown): string {
  const v = String(raw ?? 'new')
    .trim()
    .toLowerCase();
  if (v === 'new' || v === 'used' || v === 'refurbished') return v;
  if (v === 'refurb' || v === 'refurbished ') return 'refurbished';
  const legacy = String(raw ?? '').trim().toLowerCase();
  if (legacy === 'new') return 'new';
  return 'new';
}

export type ExpandedPurchaseUnit = {
  imei: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: string;
  unitBaseCost: number;
  productType: 'phone' | 'part' | 'accessory';
};

/**
 * Expands raw rows to one posting unit each (IMEI phones qty=1; parts/accessories may qty>1 with generated ids).
 * Accepts legacy `{ brand, model, price }`, `{ productName, costPrice }`, and `{ productType, quantity, ... }`.
 */
function expandPurchaseItems(raw: unknown): ExpandedPurchaseUnit[] {
  if (!Array.isArray(raw)) throw new Error('items must be an array');
  const out: ExpandedPurchaseUnit[] = [];

  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;

    const productType = normalizeProductType(r.productType);
    const condition = normalizeCondition(r.condition);
    const qty = Math.max(1, Math.floor(Number(r.quantity) || 1));
    const costPrice = Number(r.costPrice);
    const legacyPrice = Number(r.price);
    const unitBase = Number.isFinite(costPrice) && costPrice > 0 ? costPrice : legacyPrice;

    const imeiRaw = String(r.imei ?? '').trim();
    const productName = String(r.productName ?? '').trim();
    const brand = String(r.brand ?? (productName ? '-' : '')).trim() || '-';
    const model = String(r.model ?? productName ?? '').trim();
    const storage = String(r.storage ?? '-').trim() || '-';
    const color = String(r.color ?? '-').trim() || '-';

    if (!model || model === '-') throw new Error('Each purchase line requires a model (or productName)');
    if (!(unitBase > 0) || Number.isNaN(unitBase)) throw new Error('Each purchase line requires a positive unit cost');

    if (productType === 'phone') {
      if (!imeiRaw) throw new Error('Phone lines require an IMEI');
      if (qty !== 1) throw new Error('Phone lines must use quantity 1 per IMEI; add another row for additional units.');
      out.push({
        imei: imeiRaw,
        brand,
        model,
        storage,
        color,
        condition,
        unitBaseCost: unitBase,
        productType: 'phone',
      });
      continue;
    }

    // part / accessory — bulk quantity, optional IMEI (one row repeated qty times or single line)
    const prefix = productType === 'accessory' ? 'ACC' : 'PART';
    if (imeiRaw) {
      if (qty !== 1) throw new Error('When an IMEI is provided for parts/accessories, quantity must be 1.');
      out.push({
        imei: imeiRaw,
        brand,
        model,
        storage,
        color,
        condition,
        unitBaseCost: unitBase,
        productType,
      });
    } else {
      for (let i = 0; i < qty; i += 1) {
        out.push({
          imei: syntheticUnitId(prefix),
          brand,
          model,
          storage,
          color,
          condition,
          unitBaseCost: unitBase,
          productType,
        });
      }
    }
  }

  if (out.length === 0) throw new Error('At least one valid purchase item is required');
  return out;
}

function allocateLandedCosts(
  units: ExpandedPurchaseUnit[],
  extraPool: number
): { landedUnitCosts: number[]; perUnitOverhead: number[] } {
  const n = units.length;
  const subtotal = units.reduce((s, u) => safeAdd(s, u.unitBaseCost), 0);
  const landedUnitCosts: number[] = [];
  const perUnitOverhead: number[] = [];

  if (n === 0) return { landedUnitCosts: [], perUnitOverhead: [] };

  if (extraPool <= 0 || subtotal <= 0) {
    for (const u of units) {
      landedUnitCosts.push(roundMoney(u.unitBaseCost, 6));
      perUnitOverhead.push(0);
    }
    return { landedUnitCosts, perUnitOverhead };
  }

  // Proportional allocation by unit base cost; remainder on last unit
  let allocated = 0;
  for (let i = 0; i < n; i += 1) {
    const u = units[i]!;
    const share = i === n - 1 ? roundMoney(extraPool - allocated, 6) : roundMoney((extraPool * u.unitBaseCost) / subtotal, 6);
    allocated = roundMoney(safeAdd(allocated, share), 6);
    const landed = roundMoney(safeAdd(u.unitBaseCost, share), 6);
    landedUnitCosts.push(landed);
    perUnitOverhead.push(share);
  }

  return { landedUnitCosts, perUnitOverhead };
}

export const purchaseService = {
  async getAll(filters?: { branchId?: string; supplierId?: string; customerId?: string; companyId?: string | null }) {
    const ctx = getTenantContext();
    const companyId = ctx?.companyId?.trim() || requireTenantCompanyId();
    const where: any = {};
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.customerId) where.customerId = filters.customerId;

    where.companyId = companyId;

    return prisma.purchase.findMany({
      where: applyBranchScope(ctx || {}, where),
      include: { supplier: true, customer: true, branch: true, purchaseItems: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    return prisma.purchase.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      include: { supplier: true, customer: true, branch: true, purchaseItems: true },
    });
  },

  async create(data: {
    supplierId?: string;
    customerId?: string;
    branchId: string;
    userId?: string;
    items: unknown[];
    cargoCost?: number;
    taxAmount?: number;
    otherCosts?: number;
    notes?: string;
    /** ISO currency of totals; defaults USD */
    currency?: string;
  }) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    enforceBranchWrite(ctx || {}, { branchId: data.branchId });
    const effectiveBranchId =
      ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN'
        ? data.branchId
        : (ctx?.branchId as string | undefined) || data.branchId;

    if (!data.supplierId && !data.customerId) {
      throw new Error('Either supplierId or customerId is required');
    }

    const units = expandPurchaseItems(data.items);
    const merchandiseSubtotal = units.reduce((sum, u) => safeAdd(sum, u.unitBaseCost), 0);

    const branch = await prisma.branch.findFirst({ where: { id: effectiveBranchId, companyId } });
    if (!branch) throw new Error('Branch not found');

    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, companyId, isActive: true } });
      if (!supplier) throw new Error('Supplier not found');
    }
    if (data.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId } });
      if (!customer) throw new Error('Customer not found');
    }

    const currency = normalizeAndValidateCurrencyForLedger(data.currency);
    const rates = await currencyService.getRatesMap(companyId);
    const exchangeRateAtTransaction = resolveTransactionFxRate(currency, rates);

    const cargoCost = Number(data.cargoCost) || 0;
    const taxAmount = Number(data.taxAmount) || 0;
    const otherCosts = Number(data.otherCosts) || 0;
    const extraPool = roundMoney(safeAdd(safeAdd(cargoCost, taxAmount), otherCosts), 6);
    const grandTotal = roundMoney(safeAdd(merchandiseSubtotal, extraPool), 6);

    const totalAmountUsd = amountToUsdStrict(grandTotal, currency, rates);
    const cargoCostUsd = amountToUsdStrict(cargoCost, currency, rates);

    const { landedUnitCosts, perUnitOverhead } = allocateLandedCosts(units, extraPool);

    const branchName = branch.name || data.branchId;

    const { purchase, createdItems } = await prisma.$transaction(async (tx) => {
      if (data.supplierId && grandTotal > 0) {
        const supplier = await tx.supplier.findFirst({ where: { id: data.supplierId, companyId } });
        if (supplier) {
          const available = Number(supplier.availableBalance ?? 0);
          const newAvailable = roundMoney(available - grandTotal, 6);
          await tx.supplier.updateMany({
            where: { id: data.supplierId, companyId },
            data: { availableBalance: newAvailable },
          });
        }
      }

      const purchase = await tx.purchase.create({
        data: {
          companyId,
          supplierId: data.supplierId || null,
          customerId: data.customerId || null,
          branchId: effectiveBranchId,
          totalAmount: grandTotal,
          cargoCost,
          taxAmount,
          otherCosts,
          currency,
          purchaseCurrency: currency,
          totalAmountUsd,
          cargoCostUsd,
          exchangeRateAtTransaction,
          exchangeRateAtPurchase: exchangeRateAtTransaction,
          status: 'completed',
          notes: data.notes,
          purchaseItems: {
            create: units.map((u) => ({
              imei: u.imei,
              productType: u.productType,
              brand: u.brand,
              model: u.model,
              storage: u.storage,
              color: u.color,
              condition: u.condition,
              price: u.unitBaseCost,
              quantity: 1,
            })),
          },
        },
        include: { supplier: true, customer: true, branch: true, purchaseItems: true },
      });

      const createdItems: Array<{
        barcode: string;
        brand: string;
        model: string;
        storage: string;
        color: string;
        condition: string;
        price: number;
        landedUnitCost: number;
        productType: string;
      }> = [];

      for (let idx = 0; idx < units.length; idx += 1) {
        const item = units[idx]!;
        const landed = landedUnitCosts[idx]!;
        const overhead = perUnitOverhead[idx] ?? 0;
        const barcode = await getNextBarcode(companyId, tx);
        const costUsd = amountToUsdStrict(landed, currency, rates);
        const inv = await tx.inventory.create({
          data: {
            companyId,
            imei: item.imei,
            barcode,
            productType: item.productType,
            brand: item.brand,
            model: item.model,
            storage: item.storage,
            color: item.color,
            condition: item.condition,
            purchasePrice: landed,
            originalCost: item.unitBaseCost,
            originalCurrency: currency,
            costUsd,
            purchaseCurrency: currency,
            exchangeRateAtPurchase: exchangeRateAtTransaction,
            isLegacyCost: false,
            cargoCost: overhead,
            sellingPrice: roundMoney(landed * 1.2, 6),
            branchId: effectiveBranchId,
            status: 'available',
          },
        });
        createdItems.push({
          barcode,
          brand: item.brand,
          model: item.model,
          storage: item.storage,
          color: item.color,
          condition: item.condition,
          price: item.unitBaseCost,
          landedUnitCost: landed,
          productType: item.productType,
        });
        await stockMovementService.create(
          {
            inventoryId: inv.id,
            movementType: 'purchase',
            branchId: effectiveBranchId,
            referenceId: purchase.id,
            quantity: 1,
          },
          tx
        );
      }

      return { purchase, createdItems };
    });

    for (const item of units) {
      await imeiHistoryService.record(item.imei, 'purchase', {
        location: branchName,
        userId: data.userId,
        referenceId: purchase.id,
      });
    }

    return { ...purchase, createdItems };
  },
};
