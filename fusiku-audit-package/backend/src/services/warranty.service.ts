import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const warrantyService = {
  async getByImei(imei: string) {
    const companyId = requireTenantCompanyId();

    const warranty = await prisma.warranty.findFirst({
      where: { companyId, imei },
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
    const companyId = requireTenantCompanyId();
    return prisma.$transaction(async (tx) => {
      const existing = await tx.warranty.findFirst({
        where: { companyId, imei: data.imei },
        select: { id: true },
      });
      if (existing) {
        const updated = await tx.warranty.updateMany({
          where: { id: existing.id, companyId },
          data: {
            warrantyStart: data.warrantyStart,
            warrantyEnd: data.warrantyEnd,
            saleId: data.saleId,
            notes: data.notes,
          },
        });
        if (updated.count !== 1) throw new Error('Warranty update failed');
        return tx.warranty.findFirst({ where: { id: existing.id, companyId } });
      }
      return tx.warranty.create({
        data: { companyId, ...data },
      });
    });
  }
};
