import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { webhookService } from './webhook.service';
import { getTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import { applyBranchScope, enforceBranchWrite } from '../utils/branchScope';

export const repairService = {
  async getAll(filters?: { status?: string; technicianId?: string; companyId?: string | null }) {
    const ctx = getTenantContext();
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.technicianId) where.technicianId = filters.technicianId;

    return prisma.repair.findMany({
      where: applyBranchScope(ctx || {}, where),
      include: { technician: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getById(id: string) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    return prisma.repair.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      include: { technician: true }
    });
  },

  async create(data: {
    imei: string;
    faultDescription: string;
    technicianId: string;
    repairCost: number;
    customerId?: string;
    notes?: string;
  }) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();

    // Determine branch from authenticated user OR inventory location.
    const inv = await prisma.inventory.findFirst({
      where: applyBranchScope(ctx || {}, { imei: data.imei, companyId } as any),
      include: { branch: true }
    });
    const effectiveBranchId =
      (ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
        ? (inv?.branchId || null)
        : (ctx?.branchId as string | undefined) || inv?.branchId || null;

    if (effectiveBranchId) {
      enforceBranchWrite(ctx || {}, { branchId: effectiveBranchId });
    } else if (ctx?.branchId) {
      // branch user with missing inventory mapping
      enforceBranchWrite(ctx || {}, { branchId: ctx.branchId });
    }

    const repair = await prisma.repair.create({
      data: {
        ...data,
        companyId,
        branchId: effectiveBranchId,
        repairCost: Number(data.repairCost)
      } as any,
      include: { technician: true }
    });
    if (inv) {
      await stockMovementService.create({
        inventoryId: inv.id,
        movementType: 'repair',
        branchId: inv.branchId,
        userId: data.technicianId,
        referenceId: repair.id,
        quantity: 1
      });
      await imeiHistoryService.record(
        data.imei,
        'repair',
        {
          location: inv.branch?.name || inv.branchId,
          userId: data.technicianId,
          referenceId: repair.id,
        }
      );
    }
    return repair;
  },

  async update(id: string, data: Partial<{ faultDescription: string; repairCost: number; status: string; notes: string }>) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const updateData: any = { ...data };
    if (data.repairCost !== undefined) updateData.repairCost = Number(data.repairCost);

    // Manual validation for update: fetch + verify branch scope.
    const existing = await prisma.repair.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      select: { id: true, branchId: true, companyId: true } as any
    });
    if (!existing) return null;

    const updated = await prisma.repair.updateMany({
      where: { id, companyId, ...(existing.branchId ? { branchId: existing.branchId } : {}) } as any,
      data: updateData
    });
    if (updated.count === 0) return null;

    const row = await prisma.repair.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      include: { technician: true }
    });
    if (data.status === 'completed' && row?.companyId) {
      webhookService.dispatch(row.companyId, 'repair.completed', {
        repairId: row.id,
        imei: row.imei,
        faultDescription: row.faultDescription,
        repairCost: Number(row.repairCost)
      }).catch(() => {});
    }
    return row;
  }
};
