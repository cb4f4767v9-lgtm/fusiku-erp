import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';
import { currencyService } from './currency.service';
import { invoiceService } from './invoice.service';
import { normalizeAndValidateCurrencyForLedger, resolveTransactionFxRate } from '../utils/financialUsd';
import { roundMoney, sumMoney } from '../utils/money';

export const salesOrderService = {
  async list(params?: { branchId?: string; status?: string; q?: string; take?: number; skip?: number }) {
    const companyId = requireTenantCompanyId();
    const take = Math.min(100, Math.max(1, Number(params?.take ?? 50)));
    const skip = Math.max(0, Number(params?.skip ?? 0));
    const q = String(params?.q ?? '').trim();

    return prisma.salesOrder.findMany({
      where: {
        companyId,
        ...(params?.branchId ? { branchId: params.branchId } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(q
          ? {
              OR: [
                { orderNumber: { contains: q, mode: 'insensitive' } } as any,
                { customer: { name: { contains: q, mode: 'insensitive' } } } as any,
              ],
            }
          : {}),
      } as any,
      include: { customer: true, branch: true },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: { items: true, customer: true, branch: true, invoices: true },
    });
  },

  async create(data: {
    branchId: string;
    customerId?: string;
    currency?: string;
    discountPercent?: number;
    notes?: string;
    items: Array<{ inventoryId?: string; imei?: string; description?: string; quantity?: number; unitPrice?: number }>;
    userId?: string;
  }) {
    const companyId = requireTenantCompanyId();
    const currency = normalizeAndValidateCurrencyForLedger(data.currency);
    const rates = await currencyService.getRatesMap(companyId);
    const exchangeRateAtOrder = resolveTransactionFxRate(currency, rates);

    const safeItems = (Array.isArray(data.items) ? data.items : []).map((it) => ({
      inventoryId: it.inventoryId || null,
      imei: it.imei || null,
      description: it.description || null,
      quantity: Math.max(1, Number(it.quantity ?? 1)),
      unitPrice: Number(it.unitPrice ?? 0),
    }));

    const subtotal = roundMoney(sumMoney(safeItems.map((i) => i.quantity * i.unitPrice)), 6);
    const discountPercent = Math.min(100, Math.max(0, Number(data.discountPercent ?? 0)));
    const totalAmount = roundMoney(subtotal * (1 - discountPercent / 100), 6);

    return prisma.salesOrder.create({
      data: {
        companyId,
        branchId: data.branchId,
        customerId: data.customerId,
        currency,
        exchangeRateAtOrder,
        subtotal,
        discountPercent,
        totalAmount,
        notes: data.notes,
        createdById: data.userId,
        status: 'draft',
        items: {
          create: safeItems.map((i) => ({
            inventoryId: i.inventoryId,
            imei: i.imei,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: roundMoney(i.quantity * i.unitPrice, 6),
          })) as any,
        },
      } as any,
      include: { items: true, customer: true, branch: true },
    });
  },

  async update(id: string, data: Partial<{ customerId: string; currency: string; discountPercent: number; notes: string }>) {
    const companyId = requireTenantCompanyId();
    const existing = await prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Sales order not found');
    if (String(existing.status) !== 'draft') throw new Error('Only draft sales orders can be edited');

    const nextCurrency =
      data.currency != null ? normalizeAndValidateCurrencyForLedger(data.currency) : normalizeAndValidateCurrencyForLedger(existing.currency);
    const rates = await currencyService.getRatesMap(companyId);
    const exchangeRateAtOrder = resolveTransactionFxRate(nextCurrency, rates);

    await prisma.salesOrder.updateMany({
      where: { id, companyId },
      data: {
        customerId: data.customerId ?? existing.customerId,
        currency: nextCurrency,
        exchangeRateAtOrder,
        discountPercent: data.discountPercent ?? existing.discountPercent,
        notes: data.notes ?? existing.notes,
      } as any,
    });

    return this.getById(id);
  },

  async confirm(id: string) {
    const companyId = requireTenantCompanyId();
    const existing = await prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!existing) throw new Error('Sales order not found');
    if (String(existing.status) !== 'draft') throw new Error('Only draft sales orders can be confirmed');

    await prisma.salesOrder.updateMany({
      where: { id, companyId },
      data: { status: 'confirmed', confirmedAt: new Date() } as any,
    });
    return this.getById(id);
  },

  async convertToInvoice(id: string, data?: { userId?: string; notes?: string }) {
    const companyId = requireTenantCompanyId();

    return prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findFirst({
        where: { id, companyId },
        include: { items: true },
      });
      if (!so) throw new Error('Sales order not found');
      if (String(so.status) !== 'confirmed') throw new Error('Sales order must be confirmed before invoicing');

      const invItems = (so.items || [])
        .map((i: any) => ({ inventoryId: i.inventoryId as string | null }))
        .filter((x) => !!x.inventoryId) as Array<{ inventoryId: string }>;
      if (!invItems.length) throw new Error('Sales order has no inventory items to invoice');

      // Validate inventory availability before conversion (fast preflight; createFromInventory also re-checks).
      const ids = invItems.map((x) => x.inventoryId);
      const availableCount = await tx.inventory.count({
        where: { id: { in: ids }, companyId, branchId: so.branchId, status: 'available' } as any,
      });
      if (availableCount !== ids.length) {
        throw new Error('Some items already sold');
      }

      const invoice = await invoiceService.createFromInventory(
        {
          branchId: so.branchId,
          customerId: so.customerId ?? undefined,
          currency: so.currency,
          discountPercent: Number(so.discountPercent || 0),
          notes: data?.notes ?? so.notes ?? undefined,
          userId: data?.userId,
          items: invItems,
        },
        { tx }
      );

      await tx.salesOrder.updateMany({
        where: { id: so.id, companyId },
        data: { status: 'invoiced', invoicedAt: new Date() } as any,
      });

      if (invoice?.id) {
        await tx.invoice.updateMany({
          where: { id: (invoice as any).id, companyId },
          data: { salesOrderId: so.id } as any,
        });
      }

      return { salesOrderId: so.id, invoiceId: (invoice as any)?.id, invoice };
    });
  },
};

