import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { webhookService } from './webhook.service';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const posService = {
  async createSale(data: {
    branchId: string;
    customerId?: string;
    items: Array<{ inventoryId: string }>;
    paymentMethod?: string;
    notes?: string;
    discountPercent?: number;
    userId?: string;
  }) {
    const companyId = requireTenantCompanyId();

    const items = await prisma.inventory.findMany({
      where: {
        id: { in: data.items.map(i => i.inventoryId) },
        companyId,
        status: 'available'
      }
    });

    if (items.length !== data.items.length) {
      throw new Error('Some items are not available');
    }

    let subtotal = 0;
    let totalProfit = 0;
    const saleItems: Array<{ inventoryId: string; imei: string; sellingPrice: number; purchasePrice: number; profit: number }> = [];

    for (const item of items) {
      const purchasePrice = Number(item.purchasePrice);
      const sellingPrice = Number(item.sellingPrice);
      const profit = sellingPrice - purchasePrice;
      subtotal += sellingPrice;
      totalProfit += profit;
      saleItems.push({
        inventoryId: item.id,
        imei: item.imei,
        sellingPrice: item.sellingPrice,
        purchasePrice: item.purchasePrice,
        profit
      });
    }

    const discountPercent = Math.min(100, Math.max(0, data.discountPercent || 0));
    const totalAmount = subtotal * (1 - discountPercent / 100);
    const totalCost = items.reduce((s, i) => s + Number(i.purchasePrice), 0);
    const profit = totalAmount - totalCost;
    const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId } });
    if (!branch) throw new Error('Branch not found');

    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          companyId,
          branchId: data.branchId,
          customerId: data.customerId,
          totalAmount,
          profit,
          paymentMethod: data.paymentMethod || 'cash',
          notes: data.notes,
          saleItems: {
            create: saleItems
          }
        },
        include: { saleItems: true, branch: true }
      });

      for (const item of items) {
        await tx.inventory.updateMany({
          where: { id: item.id, companyId },
          data: { status: 'sold' }
        });
      }

      return s;
    });

    for (const item of items) {
      await stockMovementService.create({
        inventoryId: item.id,
        movementType: 'sale',
        branchId: data.branchId,
        referenceId: sale.id,
        quantity: 1
      });
      await imeiHistoryService.record(item.imei, 'sale', {
        location: branch.name || data.branchId,
        userId: data.userId,
        referenceId: sale.id
      });
    }

    for (const si of sale.saleItems) {
      const warrantyStart = sale.createdAt;
      const warrantyEnd = new Date(warrantyStart);
      warrantyEnd.setMonth(warrantyEnd.getMonth() + 12);
      await prisma.warranty.upsert({
        where: { imei: si.imei },
        create: { imei: si.imei, saleId: sale.id, warrantyStart, warrantyEnd },
        update: { warrantyStart, warrantyEnd, saleId: sale.id }
      });
    }

    const result = await prisma.sale.findFirst({
      where: { id: sale.id, companyId },
      include: { saleItems: true, branch: true, customer: true }
    });
    if (result && branch.companyId) {
      webhookService.dispatch(branch.companyId, 'sale.completed', {
        saleId: result.id,
        totalAmount: Number(result.totalAmount),
        profit: Number(result.profit),
        items: result.saleItems?.map((si: any) => ({ imei: si.imei, sellingPrice: Number(si.sellingPrice) }))
      }).catch(() => {});
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
