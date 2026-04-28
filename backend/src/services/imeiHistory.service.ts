import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export type IMEIActionType = 'purchase' | 'repair' | 'refurbish' | 'sale' | 'transfer';

export const imeiHistoryService = {
  async record(
    imei: string,
    actionType: IMEIActionType,
    options?: { location?: string; userId?: string; referenceId?: string }
  ) {
    const companyId = requireTenantCompanyId();
    return prisma.iMEIHistory.create({
      data: {
        companyId,
        imei,
        actionType,
        location: options?.location,
        userId: options?.userId,
        referenceId: options?.referenceId,
      },
    });
  },

  async getHistory(imei: string, limit = 50) {
    const companyId = requireTenantCompanyId();
    return prisma.iMEIHistory.findMany({
      where: { imei, companyId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  },
};
