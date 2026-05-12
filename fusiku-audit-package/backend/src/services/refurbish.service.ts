import { prisma } from '../utils/prisma';
import { imeiHistoryService } from './imeiHistory.service';
import { getTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import { applyBranchScope, enforceBranchWrite } from '../utils/branchScope';

export const refurbishService = {
  async getAll(filters?: { status?: string; technicianId?: string }) {
    const ctx = getTenantContext();
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.technicianId) where.technicianId = filters.technicianId;

    return prisma.refurbishJob.findMany({
      where: applyBranchScope(ctx || {}, where),
      include: { technician: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getById(id: string) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    return prisma.refurbishJob.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      include: { technician: true }
    });
  },

  async create(data: {
    incomingDevice: string;
    partsUsed?: string;
    laborCost: number;
    finalCondition: string;
    technicianId: string;
    notes?: string;
  }) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();

    // Determine branch from authenticated user OR inventory location (if incomingDevice is IMEI).
    let effectiveBranchId: string | null = null;
    if (ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN') {
      effectiveBranchId = null;
    } else if (ctx?.branchId) {
      effectiveBranchId = ctx.branchId;
    }

    if (!effectiveBranchId && /^\d{15}$/.test(data.incomingDevice)) {
      const inv = await prisma.inventory.findFirst({
        where: applyBranchScope(ctx || {}, { imei: data.incomingDevice, companyId } as any),
        select: { branchId: true } as any
      });
      const bid = (inv as any)?.branchId;
      if (typeof bid === 'string' && bid.trim()) effectiveBranchId = bid.trim();
    }
    if (effectiveBranchId) {
      enforceBranchWrite(ctx || {}, { branchId: effectiveBranchId });
    } else if (ctx?.branchId) {
      enforceBranchWrite(ctx || {}, { branchId: ctx.branchId });
    }

    const job = await prisma.refurbishJob.create({
      data: {
        ...data,
        companyId,
        branchId: effectiveBranchId,
        laborCost: data.laborCost
      } as any,
      include: { technician: true }
    });
    if (/^\d{15}$/.test(data.incomingDevice)) {
      await imeiHistoryService.record(
        data.incomingDevice,
        'refurbish',
        {
          userId: data.technicianId,
          referenceId: job.id,
        }
      );
    }
    return job;
  },

  async update(id: string, data: Partial<{ partsUsed: string; laborCost: number; finalCondition: string; status: string; notes: string }>) {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const updateData: any = { ...data };
    if (data.laborCost !== undefined) updateData.laborCost = data.laborCost;

    // Manual validation for update: fetch + verify branch scope.
    const existing = await prisma.refurbishJob.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      select: { id: true, branchId: true } as any
    });
    if (!existing) return null;

    const updated = await prisma.refurbishJob.updateMany({
      where: { id, companyId, ...(existing.branchId ? { branchId: existing.branchId } : {}) } as any,
      data: updateData
    });
    if (updated.count === 0) return null;
    return prisma.refurbishJob.findFirst({
      where: applyBranchScope(ctx || {}, { id, companyId } as any),
      include: { technician: true }
    });
  }
};
