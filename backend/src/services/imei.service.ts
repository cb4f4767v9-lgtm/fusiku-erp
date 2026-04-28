import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const imeiService = {
  async check(imei: string) {
    const companyId = requireTenantCompanyId();
    const inventory = await prisma.inventory.findFirst({
      where: { imei, companyId },
      include: { branch: true }
    });

    const records = await prisma.iMEIRecord.findMany({
      where: { imei, companyId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return { inventory, records };
  },

  async record(imei: string, action: string, notes?: string, inventoryId?: string) {
    const companyId = requireTenantCompanyId();
    if (inventoryId) {
      const inv = await prisma.inventory.findFirst({
        where: { id: inventoryId, companyId },
        select: { id: true },
      });
      if (!inv) throw new Error('Invalid inventory for tenant');
    }
    return prisma.iMEIRecord.create({
      data: { imei, action, notes, inventoryId, companyId },
    });
  },
};
