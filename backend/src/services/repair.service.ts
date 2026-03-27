import { prisma } from '../utils/prisma';
import { stockMovementService } from './stockMovement.service';
import { imeiHistoryService } from './imeiHistory.service';
import { webhookService } from './webhook.service';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const repairService = {
  async getAll(filters?: { status?: string; technicianId?: string; companyId?: string | null }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.technicianId) where.technicianId = filters.technicianId;
    if (filters?.companyId) where.companyId = filters.companyId;

    return prisma.repair.findMany({
      where,
      include: { technician: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.repair.findFirst({
      where: { id, companyId },
      include: { technician: true }
    });
  },

  async create(data: {
    imei: string;
    faultDescription: string;
    technicianId: string;
    repairCost: number;
    companyId?: string;
    customerId?: string;
    notes?: string;
  }) {
    const companyId = data.companyId ?? requireTenantCompanyId();
    const repair = await prisma.repair.create({
      data: {
        ...data,
        companyId,
        repairCost: Number(data.repairCost)
      },
      include: { technician: true }
    });
    const inv = await prisma.inventory.findFirst({
      where: { imei: data.imei, companyId },
      include: { branch: true }
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
      await imeiHistoryService.record(data.imei, 'repair', {
        location: inv.branch?.name || inv.branchId,
        userId: data.technicianId,
        referenceId: repair.id
      });
    }
    return repair;
  },

  async update(id: string, data: Partial<{ faultDescription: string; repairCost: number; status: string; notes: string }>) {
    const companyId = requireTenantCompanyId();
    const updateData: any = { ...data };
    if (data.repairCost !== undefined) updateData.repairCost = Number(data.repairCost);

    const updated = await prisma.repair.updateMany({
      where: { id, companyId },
      data: updateData
    });
    if (updated.count === 0) return null;

    const row = await prisma.repair.findFirst({
      where: { id, companyId },
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
