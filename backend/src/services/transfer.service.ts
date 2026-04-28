import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { getTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import { auditLogService } from './auditLog.service';

export const transferService = {
  async getAll(filters?: { fromBranchId?: string; toBranchId?: string; status?: string }) {
    const ctx = getTenantContext();
    const where: any = {};
    if (filters?.fromBranchId) where.fromBranchId = filters.fromBranchId;
    if (filters?.toBranchId) where.toBranchId = filters.toBranchId;
    if (filters?.status) where.status = filters.status;

    // Branch users can only see transfers involving their branch.
    if (ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')) {
      const bid = String(ctx.branchId).trim();
      if (!bid) throw new Error('Branch context required');
      if (where.fromBranchId && where.fromBranchId !== bid) throw new Error('Forbidden: cross-branch access');
      if (where.toBranchId && where.toBranchId !== bid) throw new Error('Forbidden: cross-branch access');
      where.OR = [{ fromBranchId: bid }, { toBranchId: bid }];
    }

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
    const ctx = getTenantContext();
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

    // Branch roles can only approve transfers FROM their branch.
    if (ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')) {
      if (transfer.fromBranchId !== ctx.branchId) {
        const e: any = new Error('Forbidden: you can only approve transfers from your branch.');
        e.statusCode = 403;
        throw e;
      }
    }

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

      for (const inv of items) {
        await stockMovementService.create(
          {
            inventoryId: inv.id,
            movementType: 'transfer',
            branchId: transfer.fromBranchId,
            userId: approvedById,
            referenceId: transfer.id,
            quantity: 1
          },
          tx
        );
      }
    });

    for (const inv of items) {
      await imeiHistoryService.record(
        inv.imei,
        'transfer',
        {
          location: `${transfer.fromBranch?.name || transfer.fromBranchId} → ${transfer.toBranch?.name || transfer.toBranchId}`,
          userId: approvedById,
          referenceId: transfer.id,
        }
      );
    }

    const approved = await prisma.transfer.findFirst({
      where: { id, companyId },
      include: {
        fromBranch: true,
        toBranch: true,
        createdBy: true,
        transferItems: { include: { inventory: true } }
      }
    });
    if (approved) {
      await auditLogService.log({
        action: 'transfer_approve',
        entity: 'Transfer',
        entityId: approved.id,
        branchId: approved.fromBranchId,
        metadata: {
          fromBranchId: approved.fromBranchId,
          toBranchId: approved.toBranchId,
          status: approved.status,
          itemCount: approved.transferItems?.length ?? 0,
        },
      });
    }
    return approved;
  },

  async getById(id: string) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const row = await prisma.transfer.findFirst({
      where: { id, companyId },
      include: {
        fromBranch: true,
        toBranch: true,
        createdBy: true,
        transferItems: { include: { inventory: true } }
      }
    });
    if (!row) return row;
    if (ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')) {
      if (row.fromBranchId !== ctx.branchId && row.toBranchId !== ctx.branchId) {
        const e: any = new Error('Forbidden: cross-branch access');
        e.statusCode = 403;
        throw e;
      }
    }
    return row;
  },

  async create(data: {
    fromBranchId: string;
    toBranchId: string;
    createdById: string;
    inventoryIds: string[];
    transferMarginPercent?: number;
  }) {
    const ctx = getTenantContext();
    // Enforce transfer rules:
    // - Branch users/admins can only create transfers FROM their own branch.
    // - Super admin can transfer between any branches (validated by company).
    if (ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')) {
      const bid = String(ctx.branchId).trim();
      if (!bid) {
        const e: any = new Error('Branch context required for transfers');
        e.statusCode = 403;
        throw e;
      }
      if (String(data.fromBranchId || '').trim() !== bid) {
        const e: any = new Error('Forbidden: transfers must originate from your branch');
        e.statusCode = 403;
        throw e;
      }
    }

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

    const created = await prisma.transfer.findFirst({
      where: { id: transfer.id, companyId },
      include: {
        fromBranch: true,
        toBranch: true,
        createdBy: true,
        transferItems: { include: { inventory: true } }
      }
    });
    if (created) {
      await auditLogService.log({
        action: 'transfer_create',
        entity: 'Transfer',
        entityId: created.id,
        branchId: created.fromBranchId,
        metadata: {
          fromBranchId: created.fromBranchId,
          toBranchId: created.toBranchId,
          status: created.status,
          itemCount: created.transferItems?.length ?? 0,
        },
      });
    }
    return created;
  }
};
