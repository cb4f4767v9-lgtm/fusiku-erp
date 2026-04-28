import { prisma } from '../utils/prisma';
import { webhookService } from './webhook.service';
import { requireTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import { roundMoney } from '../utils/money';
import {
  amountToUsdStrict,
  inventoryLegacyCostDisplayNote,
  normalizeAndValidateCurrencyForLedger,
  resolveTransactionFxRate
} from '../utils/financialUsd';
import { currencyService } from './currency.service';
import { applyBranchScope, enforceBranchWrite } from '../utils/branchScope';
import { auditLogService } from './auditLog.service';

/** Serialized map value for `GET /inventory/pricing-context` (keyed by IMEI). */
export type InventoryPricingContext = {
  imei: string;
  branchId: string;
  branchName: string;
  purchasePrice: number;
  sellingPrice: number;
  /** Ledger USD cost; when `costUsd` is null in DB, uses `purchasePrice` per legacy-row convention. */
  costUsd: number;
  purchaseCurrency: string | null;
  exchangeRateAtPurchase: number | null;
  isLegacyCost: boolean;
  cargoCost: number;
};

export const inventoryService = {

  async getAll(filters?: any) {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();

    const where: any = { companyId };

    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.status) where.status = filters.status;

    const qStr = (v: unknown) => {
      const s = String(v ?? '').trim();
      return s || undefined;
    };
    const ic = (s: string) => ({ contains: s, mode: 'insensitive' as const });
    const brand = qStr(filters?.brand);
    if (brand) where.brand = ic(brand);
    const model = qStr(filters?.model);
    if (model) where.model = ic(model);
    const storage = qStr(filters?.storage);
    if (storage) where.storage = ic(storage);
    const color = qStr(filters?.color);
    if (color) where.color = ic(color);
    const condition = qStr(filters?.condition);
    if (condition) where.condition = ic(condition);

    if (filters?.search) {
      const s = String(filters.search).trim();
      if (s) {
        where.OR = [
          { imei: { contains: s, mode: 'insensitive' } },
          { brand: { contains: s, mode: 'insensitive' } },
          { model: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const scopedWhere = applyBranchScope(ctx, where);

    // Keep legacy internal contract: return plain array for internal callers (e.g. public API sanitizers).
    return prisma.inventory.findMany({
      where: scopedWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        imei: true,
        barcode: true,
        brand: true,
        model: true,
        storage: true,
        color: true,
        condition: true,
        status: true,
        branchId: true,
        purchasePrice: true,
        sellingPrice: true,
        purchaseCurrency: true,
        exchangeRateAtPurchase: true,
        costUsd: true,
        isLegacyCost: true,
        cargoCost: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
      } as any,
    });
  },

  async list(filters?: any) {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();

    // Reuse filtering logic by delegating to getAll for `where` building? (avoid double queries)
    // Here we rebuild the same where; keep behavior identical.
    const where: any = { companyId };
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.status) where.status = filters.status;

    const qStr = (v: unknown) => {
      const s = String(v ?? '').trim();
      return s || undefined;
    };
    const ic = (s: string) => ({ contains: s, mode: 'insensitive' as const });
    const brand = qStr(filters?.brand);
    if (brand) where.brand = ic(brand);
    const model = qStr(filters?.model);
    if (model) where.model = ic(model);
    const storage = qStr(filters?.storage);
    if (storage) where.storage = ic(storage);
    const color = qStr(filters?.color);
    if (color) where.color = ic(color);
    const condition = qStr(filters?.condition);
    if (condition) where.condition = ic(condition);

    if (filters?.search) {
      const s = String(filters.search).trim();
      if (s) {
        where.OR = [
          { imei: { contains: s, mode: 'insensitive' } },
          { brand: { contains: s, mode: 'insensitive' } },
          { model: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const limitRaw = filters?.limit ?? filters?.take ?? 50;
    const pageRaw = filters?.page;
    const take = Math.min(100, Math.max(1, Number(limitRaw)));
    const skip =
      pageRaw != null
        ? Math.max(0, (Math.max(1, Number(pageRaw)) - 1) * take)
        : Math.max(0, Number(filters?.skip ?? 0));
    const page = Math.floor(skip / take) + 1;

    const scopedWhere = applyBranchScope(ctx, where);

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({
        where: scopedWhere,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          imei: true,
          barcode: true,
          brand: true,
          model: true,
          storage: true,
          color: true,
          condition: true,
          status: true,
          branchId: true,
          purchasePrice: true,
          sellingPrice: true,
          purchaseCurrency: true,
          exchangeRateAtPurchase: true,
          costUsd: true,
          isLegacyCost: true,
          cargoCost: true,
          createdAt: true,
          updatedAt: true,
          branch: { select: { id: true, name: true } },
        } as any,
      }),
      prisma.inventory.count({ where: scopedWhere }),
    ]);

    return { success: true, data: items, meta: { total, page, limit: take } };
  },

  async getByImei(imei: string) {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();

    return prisma.inventory.findFirst({
      where: applyBranchScope(ctx, { imei, companyId }),
      include: { branch: true }
    });
  },

  async getByBarcode(barcode: string) {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();
    const b = String(barcode ?? '').trim();
    if (!b) return null;

    return prisma.inventory.findFirst({
      where: applyBranchScope(ctx, { barcode: b, companyId }),
      include: { branch: true }
    });
  },

  async getPricingContextByImeis(imeis: string[]): Promise<Record<string, InventoryPricingContext>> {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();
    const unique = [...new Set(imeis.map((x) => String(x ?? '').trim()).filter(Boolean))].slice(0, 500);
    if (unique.length === 0) return {};

    const rows = await prisma.inventory.findMany({
      where: applyBranchScope(ctx, {
        companyId,
        imei: { in: unique }
      }),
      include: { branch: true }
    });

    const out: Record<string, InventoryPricingContext> = {};
    for (const row of rows) {
      const costUsdRaw =
        row.costUsd != null && Number.isFinite(row.costUsd)
          ? row.costUsd
          : Number(row.purchasePrice);
      out[row.imei] = {
        imei: row.imei,
        branchId: row.branchId,
        branchName: row.branch?.name ?? '',
        purchasePrice: row.purchasePrice,
        sellingPrice: row.sellingPrice,
        costUsd: roundMoney(costUsdRaw),
        purchaseCurrency: row.purchaseCurrency,
        exchangeRateAtPurchase: row.exchangeRateAtPurchase,
        isLegacyCost: row.isLegacyCost,
        cargoCost: row.cargoCost
      };
    }
    return out;
  },

  async create(data: any) {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();

    enforceBranchWrite(ctx, { branchId: data.branchId });

    const exists = await prisma.inventory.findFirst({
      where: { imei: data.imei, companyId }
    });

    if (exists) throw new Error('IMEI already exists');

    const purchaseCurrency = normalizeAndValidateCurrencyForLedger('USD');
    const rates = await currencyService.getRatesMap(companyId);
    const exchangeRateAtPurchase = resolveTransactionFxRate(purchaseCurrency, rates);

    const purchasePrice = Number(data.purchasePrice);
    const costUsd = amountToUsdStrict(purchasePrice, purchaseCurrency, rates);

    const created = await prisma.inventory.create({
      data: {
        ...data,
        companyId,
        purchasePrice,
        costUsd,
        purchaseCurrency,
        exchangeRateAtPurchase,
        isLegacyCost: false,
      },
      include: { branch: true }
    });

    await auditLogService.log({
      action: 'inventory_create',
      entity: 'Inventory',
      entityId: created.id,
      branchId: created.branchId,
      metadata: { imei: created.imei }
    });

    return created;
  },

  async update(id: string, data: any) {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();

    enforceBranchWrite(ctx, { branchId: data.branchId });

    const existing = await prisma.inventory.findFirst({
      where: applyBranchScope(ctx, { id, companyId })
    });

    if (!existing) throw new Error('Inventory not found');

    const updated = await prisma.inventory.update({
      where: { id: existing.id },
      data
    });

    await webhookService.dispatch(companyId, 'inventory.updated', {
      inventoryId: updated.id
    }).catch(() => {});

    await auditLogService.log({
      action: 'inventory_update',
      entity: 'Inventory',
      entityId: updated.id,
      branchId: updated.branchId
    });

    return updated;
  },

  async delete(id: string) {
    const ctx = requireTenantContext();
    const companyId = requireTenantCompanyId();

    const existing = await prisma.inventory.findFirst({
      where: applyBranchScope(ctx, { id, companyId })
    });

    if (!existing) throw new Error('Inventory not found');

    await prisma.inventory.delete({
      where: { id: existing.id }
    });

    await auditLogService.log({
      action: 'inventory_delete',
      entity: 'Inventory',
      entityId: existing.id,
      branchId: existing.branchId
    });

    return { success: true };
  }
};