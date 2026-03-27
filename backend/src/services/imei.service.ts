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
      where: { imei, inventory: { companyId } },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return { inventory, records };
  },

  async record(imei: string, action: string, notes?: string, inventoryId?: string) {
    return prisma.iMEIRecord.create({
      data: { imei, action, notes, inventoryId }
    });
  }
};
