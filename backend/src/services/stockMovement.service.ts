import { prisma } from '../utils/prisma';

type MovementType = 'purchase' | 'sale' | 'repair' | 'refurbish' | 'transfer' | 'adjustment';

export const stockMovementService = {
  async create(data: {
    inventoryId: string;
    movementType: MovementType;
    branchId: string;
    userId?: string;
    referenceId?: string;
    quantity?: number;
  }) {
    const inv = await prisma.inventory.findFirst({
      where: { id: data.inventoryId },
      select: { companyId: true }
    });
    if (!inv) throw new Error('Inventory not found');
    return prisma.stockMovement.create({
      data: {
        companyId: inv.companyId,
        movementType: data.movementType,
        inventoryId: data.inventoryId,
        branchId: data.branchId,
        userId: data.userId,
        referenceId: data.referenceId,
        quantity: data.quantity ?? 1
      }
    });
  },

  async getByInventory(inventoryId: string) {
    return prisma.stockMovement.findMany({
      where: { inventoryId },
      include: { branch: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getAll(filters?: { branchId?: string; type?: string; inventoryId?: string; startDate?: Date; endDate?: Date }) {
    const where: any = {};
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.inventoryId) where.inventoryId = filters.inventoryId;
    if (filters?.type) where.movementType = filters.type;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }
    return prisma.stockMovement.findMany({
      where,
      include: { inventory: true, branch: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  },

  async getByBranch(branchId: string, filters?: { type?: string; startDate?: Date; endDate?: Date }) {
    const where: any = { branchId };
    if (filters?.type) where.movementType = filters.type;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }
    return prisma.stockMovement.findMany({
      where,
      include: { inventory: true, branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }
};
