import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';
import { pickPricingRule } from './pricingRule.service';
import type { QuotationGenerateBody } from '../core/validation/schemas/quotation.schemas';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type QuotationSummary = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  createdAt: Date;
  itemCount: number;
};

export const quotationService = {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const companyId = requireTenantCompanyId();
    const limit = Math.min(100, Math.max(1, Number(params?.take ?? 50)));
    const skip = Math.max(0, Number(params?.skip ?? 0));
    const q = String(params?.q ?? '').trim();

    const where = {
      companyId,
      ...(q
        ? {
            OR: [
              { customerName: { contains: q, mode: 'insensitive' as const } },
              { customerPhone: { contains: q, mode: 'insensitive' as const } },
              { notes: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: { _count: { select: { items: true } } },
      }),
      prisma.quotation.count({ where }),
    ]);

    const data: QuotationSummary[] = items.map((q) => ({
      id: q.id,
      customerName: q.customerName,
      customerPhone: q.customerPhone,
      totalAmount: q.totalAmount,
      createdAt: q.createdAt,
      itemCount: q._count.items,
    }));

    return { success: true, data, meta: { total, limit, skip } };
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.quotation.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            inventory: {
              select: { id: true, brand: true, model: true, storage: true, color: true, imei: true },
            },
          },
        },
      },
    });
  },

  /**
   * Auto-generate a quotation:
   *  1. Resolve cost price for each item (inventory.purchasePrice or override).
   *  2. Pick the matching PricingRule (or fall back to highest band).
   *  3. Persist Quotation + QuotationItem rows in one transaction.
   *  4. Return the full quotation with items and rule metadata.
   */
  async generate(payload: QuotationGenerateBody, opts?: { createdById?: string | null }) {
    const companyId = requireTenantCompanyId();

    type ResolvedItem = {
      inventoryId: string | null;
      description: string | null;
      quantity: number;
      costPrice: number;
      sellingPrice: number;
      profitPercent: number;
      pricingRuleId: string | null;
      ruleSource: 'matched' | 'fallback_highest' | 'fallback_zero';
    };

    // Pre-fetch any referenced inventory rows in one query (tenant-scoped).
    const inventoryIds = payload.items
      .map((i) => i.inventoryId)
      .filter((id): id is string => Boolean(id));

    const inventoryRows = inventoryIds.length
      ? await prisma.inventory.findMany({
          where: { id: { in: inventoryIds }, companyId },
          select: {
            id: true,
            brand: true,
            model: true,
            storage: true,
            color: true,
            purchasePrice: true,
          },
        })
      : [];
    const inventoryById = new Map(inventoryRows.map((r) => [r.id, r] as const));

    const resolved: ResolvedItem[] = [];

    for (const raw of payload.items) {
      let inventoryId: string | null = null;
      let description: string | null = null;
      let cost = 0;

      if (raw.inventoryId) {
        const inv = inventoryById.get(raw.inventoryId);
        if (!inv) {
          const err: any = new Error(`Inventory not found or not in tenant: ${raw.inventoryId}`);
          err.statusCode = 400;
          throw err;
        }
        inventoryId = inv.id;
        description =
          raw.description?.trim() ||
          [inv.brand, inv.model, inv.storage, inv.color].filter(Boolean).join(' ').trim() ||
          null;
        cost = raw.costPrice != null ? Number(raw.costPrice) : Number(inv.purchasePrice || 0);
      } else {
        description = raw.description?.trim() || null;
        cost = Number(raw.costPrice ?? 0);
      }

      const match = await pickPricingRule(cost);
      const quantity = Math.max(1, Math.trunc(Number(raw.quantity ?? 1)));

      resolved.push({
        inventoryId,
        description,
        quantity,
        costPrice: round2(cost),
        sellingPrice: round2(match.sellingPrice),
        profitPercent: match.profitPercent,
        pricingRuleId: match.rule?.id ?? null,
        ruleSource: match.source,
      });
    }

    const totalAmount = round2(
      resolved.reduce((sum, it) => sum + it.sellingPrice * it.quantity, 0)
    );

    const created = await prisma.quotation.create({
      data: {
        companyId,
        customerName: payload.customerName?.trim() || null,
        customerPhone: payload.customerPhone?.trim() || null,
        notes: payload.notes?.trim() || null,
        totalAmount,
        createdById: opts?.createdById ?? null,
        items: {
          create: resolved.map((it) => ({
            inventoryId: it.inventoryId,
            description: it.description,
            quantity: it.quantity,
            costPrice: it.costPrice,
            sellingPrice: it.sellingPrice,
            profitPercent: it.profitPercent,
            pricingRuleId: it.pricingRuleId,
          })),
        },
      },
      include: {
        items: {
          include: {
            inventory: {
              select: { id: true, brand: true, model: true, storage: true, color: true, imei: true },
            },
          },
        },
      },
    });

    // Attach rule source per line for the response (not persisted) so the UI
    // can flag fallback rows (e.g. "highest band used" badge).
    const itemsWithSource = created.items.map((row, idx) => ({
      ...row,
      ruleSource: resolved[idx]?.ruleSource ?? 'matched',
    }));

    return { ...created, items: itemsWithSource };
  },

  async remove(id: string) {
    const companyId = requireTenantCompanyId();
    const existing = await prisma.quotation.findFirst({ where: { id, companyId } });
    if (!existing) {
      const err: any = new Error('Quotation not found');
      err.statusCode = 404;
      throw err;
    }
    await prisma.quotation.delete({ where: { id } });
    return { success: true };
  },

  /**
   * Build a plain-text share message for a quotation (WhatsApp/SMS).
   * Caller decides currency suffix (defaults to "AED" to match shop locale).
   */
  buildShareText(
    quotation: { items: Array<{ description: string | null; sellingPrice: number; quantity: number }> },
    opts?: { currency?: string }
  ): string {
    const currency = (opts?.currency || 'AED').toUpperCase();
    const lines: string[] = [];
    for (const it of quotation.items) {
      const name = (it.description || 'Item').trim();
      const total = round2(it.sellingPrice * Math.max(1, it.quantity));
      const qtySuffix = it.quantity > 1 ? ` x${it.quantity}` : '';
      lines.push(`Product: ${name}${qtySuffix}`);
      lines.push(`Price: ${total} ${currency}`);
    }
    return lines.join('\n');
  },
};
