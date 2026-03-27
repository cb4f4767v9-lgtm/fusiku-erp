import { prisma } from '../utils/prisma';
import { imeiHistoryService } from './imeiHistory.service';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const refurbishService = {
  async getAll(filters?: { status?: string; technicianId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.technicianId) where.technicianId = filters.technicianId;

    return prisma.refurbishJob.findMany({
      where,
      include: { technician: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.refurbishJob.findFirst({
      where: { id, companyId },
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
    const companyId = requireTenantCompanyId();
    const job = await prisma.refurbishJob.create({
      data: {
        ...data,
        companyId,
        laborCost: data.laborCost
      },
      include: { technician: true }
    });
    if (/^\d{15}$/.test(data.incomingDevice)) {
      await imeiHistoryService.record(data.incomingDevice, 'refurbish', {
        userId: data.technicianId,
        referenceId: job.id
      });
    }
    return job;
  },

  async update(id: string, data: Partial<{ partsUsed: string; laborCost: number; finalCondition: string; status: string; notes: string }>) {
    const companyId = requireTenantCompanyId();
    const updateData: any = { ...data };
    if (data.laborCost !== undefined) updateData.laborCost = data.laborCost;

    const updated = await prisma.refurbishJob.updateMany({
      where: { id, companyId },
      data: updateData
    });
    if (updated.count === 0) return null;
    return prisma.refurbishJob.findFirst({
      where: { id, companyId },
      include: { technician: true }
    });
  }
};
