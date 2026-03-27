import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const transferService = {
  async getAll(filters?: { fromBranchId?: string; toBranchId?: string; status?: string }) {
    const where: any = {};
    if (filters?.fromBranchId) where.fromBranchId = filters.fromBranchId;
    if (filters?.toBranchId) where.toBranchId = filters.toBranchId;
    if (filters?.status) where.status = filters.status;

    return prisma.transfer.findMany({
      where,
      include: {
        fromBranch: true,
        toBranch: true,
        createdBy: true,
        transferItems: { include: { inventory: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async approve(id: string, approvedById: string) {
    const companyId = requireTenantCompanyId();
    const transfer = await prisma.transfer.findFirst({
      where: { id, companyId },
      include: {
        fromBranch: true,
        toBranch: true,
        transferItems: { include: { inventory: true } }
      }
    });
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'pending') throw new Error('Transfer already processed');

    const items = transfer.transferItems.map((ti) => ti.inventory);
    const marginPercent = Number(transfer.transferMarginPercent ?? 0) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.transfer.updateMany({
        where: { id, companyId },
        data: { status: 'completed', approvedById, approvedAt: new Date() }
      });
      for (const item of items) {
        const purchaseCost = Number(item.purchasePrice ?? 0);
        const cargoCost = Number(item.cargoCost ?? 0);
        const baseCost = purchaseCost + cargoCost;
        const branchCost = marginPercent > 0 ? baseCost * (1 + marginPercent) : baseCost;
        const newSellingPrice = branchCost * 1.2;

        await tx.inventory.updateMany({
          where: { id: item.id, companyId },
          data: {
            branchId: transfer.toBranchId,
            purchasePrice: branchCost,
            sellingPrice: newSellingPrice
          }
        });
      }
    });

    for (const inv of items) {
      await stockMovementService.create({
        inventoryId: inv.id,
        movementType: 'transfer',
        branchId: transfer.fromBranchId,
        userId: approvedById,
        referenceId: transfer.id,
        quantity: 1
      });
      await imeiHistoryService.record(inv.imei, 'transfer', {
        location: `${transfer.fromBranch?.name || transfer.fromBranchId} → ${transfer.toBranch?.name || transfer.toBranchId}`,
        userId: approvedById,
        referenceId: transfer.id
      });
    }

    return prisma.transfer.findFirst({
      where: { id, companyId },
      include: {
        fromBranch: true,
        toBranch: true,
        createdBy: true,
        transferItems: { include: { inventory: true } }
      }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.transfer.findFirst({
      where: { id, companyId },
      include: {
        fromBranch: true,
        toBranch: true,
        createdBy: true,
        transferItems: { include: { inventory: true } }
      }
    });
  },

  async create(data: {
    fromBranchId: string;
    toBranchId: string;
    createdById: string;
    inventoryIds: string[];
    transferMarginPercent?: number;
  }) {
    if (data.fromBranchId === data.toBranchId) {
      throw new Error('Cannot transfer to same branch');
    }

    const companyId = requireTenantCompanyId();
    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findFirst({ where: { id: data.fromBranchId, companyId } }),
      prisma.branch.findFirst({ where: { id: data.toBranchId, companyId } })
    ]);
    if (!fromBranch || !toBranch) throw new Error('Invalid branch for this company');

    const items = await prisma.inventory.findMany({
      where: {
        id: { in: data.inventoryIds },
        companyId,
        branchId: data.fromBranchId,
        status: 'available'
      }
    });

    if (items.length !== data.inventoryIds.length) {
      throw new Error('Some items are not available or not in source branch');
    }

    const transfer = await prisma.transfer.create({
      data: {
        companyId,
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        createdById: data.createdById,
        status: 'pending',
        transferMarginPercent: Number(data.transferMarginPercent ?? 0),
        transferItems: {
          create: data.inventoryIds.map((inventoryId) => ({ inventoryId }))
        }
      },
      include: { transferItems: true }
    });

    return prisma.transfer.findFirst({
      where: { id: transfer.id, companyId },
      include: {
        fromBranch: true,
        toBranch: true,
        createdBy: true,
        transferItems: { include: { inventory: true } }
      }
    });
  }
};
