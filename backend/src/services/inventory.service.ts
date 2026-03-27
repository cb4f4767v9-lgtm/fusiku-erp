import { prisma } from '../utils/prisma';
import { webhookService } from './webhook.service';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const inventoryService = {
  async getAll(filters?: {
    branchId?: string;
    companyId?: string | null;
    status?: string;
    search?: string;
    brand?: string;
    model?: string;
    storage?: string;
    color?: string;
    condition?: string;
  }) {
    const where: any = {};
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.companyId) where.branch = { companyId: filters.companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.brand?.trim()) where.brand = { contains: filters.brand.trim() };
    if (filters?.model?.trim()) where.model = { contains: filters.model.trim() };
    if (filters?.storage?.trim()) where.storage = { contains: filters.storage.trim() };
    if (filters?.color?.trim()) where.color = { contains: filters.color.trim() };
    if (filters?.condition?.trim()) where.condition = { contains: filters.condition.trim() };
    if (filters?.search) {
      where.OR = [
        { imei: { contains: filters.search } },
        { brand: { contains: filters.search } },
        { model: { contains: filters.search } },
        { storage: { contains: filters.search } },
        { color: { contains: filters.search } },
        { condition: { contains: filters.search } }
      ];
    }

    return prisma.inventory.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getByImei(imei: string) {
    const companyId = requireTenantCompanyId();
    return prisma.inventory.findFirst({
      where: { imei, companyId },
      include: { branch: true }
    });
  },

  async getByBarcode(barcode: string) {
    const companyId = requireTenantCompanyId();
    return prisma.inventory.findFirst({
      where: { barcode, companyId },
      include: { branch: true }
    });
  },

  async create(data: {
    imei: string;
    brand: string;
    model: string;
    storage: string;
    color: string;
    condition: string;
    purchasePrice: number;
    sellingPrice: number;
    branchId: string;
    notes?: string;
  }) {
    const companyId = requireTenantCompanyId();
    const exists = await prisma.inventory.findFirst({ where: { imei: data.imei, companyId } });
    if (exists) throw new Error('IMEI already exists');

    return prisma.inventory.create({
      data: {
        ...data,
        companyId,
        purchasePrice: Number(data.purchasePrice),
        sellingPrice: Number(data.sellingPrice)
      },
      include: { branch: true }
    });
  },

  async update(id: string, data: Partial<{
    brand: string;
    model: string;
    storage: string;
    color: string;
    condition: string;
    purchasePrice: number;
    sellingPrice: number;
    status: string;
    notes: string;
  }>) {
    const companyId = requireTenantCompanyId();
    const updateData: any = { ...data };
    if (data.purchasePrice !== undefined) updateData.purchasePrice = Number(data.purchasePrice);
    if (data.sellingPrice !== undefined) updateData.sellingPrice = Number(data.sellingPrice);

    const updated = await prisma.inventory.updateMany({
      where: { id, companyId },
      data: updateData
    });
    if (updated.count === 0) throw new Error('Inventory not found');

    const row = await prisma.inventory.findFirst({
      where: { id, companyId },
      include: { branch: true }
    });
    if (!row) throw new Error('Inventory not found');
    if (row.branch?.companyId) {
      webhookService.dispatch(row.branch.companyId, 'inventory.updated', {
        inventoryId: row.id,
        imei: row.imei,
        brand: row.brand,
        model: row.model,
        status: row.status
      }).catch(() => {});
    }
    return row;
  },

  async delete(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.inventory.deleteMany({ where: { id, companyId } });
  }
};
