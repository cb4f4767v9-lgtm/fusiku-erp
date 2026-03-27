import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { requireTenantCompanyId } from '../utils/tenantContext';

async function getNextBarcode(companyId: string): Promise<string> {
  const seq = await prisma.barcodeSequence.upsert({
    where: { companyId },
    create: { companyId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } }
  });
  return 'FUS' + String(seq.lastNumber).padStart(8, '0');
}

export const purchaseService = {
  async getAll(filters?: { branchId?: string; supplierId?: string; customerId?: string; companyId?: string | null }) {
    const where: any = {};
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.companyId) where.companyId = filters.companyId;

    return prisma.purchase.findMany({
      where,
      include: { supplier: true, customer: true, branch: true, purchaseItems: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.purchase.findFirst({
      where: { id, companyId },
      include: { supplier: true, customer: true, branch: true, purchaseItems: true }
    });
  },

  async create(data: {
    supplierId?: string;
    customerId?: string;
    branchId: string;
    userId?: string;
    items: Array<{ imei: string; brand: string; model: string; storage: string; color: string; condition: string; price: number }>;
    cargoCost?: number;
    notes?: string;
  }) {
    const companyId = requireTenantCompanyId();
    if (!data.supplierId && !data.customerId) {
      throw new Error('Either supplierId or customerId is required');
    }
    const totalAmount = data.items.reduce((sum, i) => sum + i.price, 0);

    if (data.supplierId && totalAmount > 0) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, companyId } });
      if (supplier) {
        const available = Number(supplier.availableBalance ?? 0);
        const newAvailable = available - totalAmount;
        await prisma.supplier.updateMany({
          where: { id: data.supplierId, companyId },
          data: { availableBalance: newAvailable }
        });
      }
    }

    const cargoCost = Number(data.cargoCost) || 0;
    const itemCount = data.items.length;
    const cargoPerItem = itemCount > 0 ? cargoCost / itemCount : 0;

    const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId } });
    if (!branch) throw new Error('Branch not found');

    const purchase = await prisma.purchase.create({
      data: {
        companyId,
        supplierId: data.supplierId || null,
        customerId: data.customerId || null,
        branchId: data.branchId,
        totalAmount,
        cargoCost,
        status: 'completed',
        notes: data.notes,
        purchaseItems: {
          create: data.items.map(i => ({
            ...i,
            price: i.price,
            quantity: 1
          }))
        }
      },
      include: { supplier: true, customer: true, branch: true, purchaseItems: true }
    });

    const branchName = branch.name || data.branchId;
    const createdItems: Array<{ barcode: string; brand: string; model: string; storage: string; color: string; condition: string; price: number }> = [];
    for (const item of data.items) {
      await imeiHistoryService.record(item.imei, 'purchase', {
        location: branchName,
        userId: data.userId,
        referenceId: purchase.id
      });
      const barcode = await getNextBarcode(companyId);
      const finalCost = item.price + cargoPerItem;
      const inv = await prisma.inventory.create({
        data: {
          companyId,
          imei: item.imei,
          barcode,
          brand: item.brand,
          model: item.model,
          storage: item.storage,
          color: item.color,
          condition: item.condition,
          purchasePrice: finalCost,
          cargoCost: cargoPerItem,
          sellingPrice: finalCost * 1.2,
          branchId: data.branchId,
          status: 'available'
        }
      });
      createdItems.push({
        barcode,
        brand: item.brand,
        model: item.model,
        storage: item.storage,
        color: item.color,
        condition: item.condition,
        price: item.price
      });
      await stockMovementService.create({
        inventoryId: inv.id,
        movementType: 'purchase',
        branchId: data.branchId,
        referenceId: purchase.id,
        quantity: 1
      });
    }

    return { ...purchase, createdItems };
  }
};
