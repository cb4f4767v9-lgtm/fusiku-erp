import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const warrantyService = {
  async getByImei(imei: string) {
    const companyId = requireTenantCompanyId();

    const warranty = await prisma.warranty.findFirst({
      where: { imei, sale: { companyId } },
      include: { sale: true }
    });
    if (warranty) return warranty;

    const saleItem = await prisma.saleItem.findFirst({
      where: { imei, sale: { companyId } },
      include: { sale: true }
    });
    if (!saleItem) return null;

    const warrantyStart = saleItem.sale.createdAt;
    const warrantyEnd = new Date(warrantyStart);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + 12);
    const isActive = new Date() <= warrantyEnd;

    return {
      imei: saleItem.imei,
      saleId: saleItem.saleId,
      warrantyStart,
      warrantyEnd,
      isActive,
      notes: null
    };
  },

  async create(data: { imei: string; warrantyStart: Date; warrantyEnd: Date; saleId?: string; notes?: string }) {
    return prisma.warranty.upsert({
      where: { imei: data.imei },
      update: data,
      create: data
    });
  }
};
