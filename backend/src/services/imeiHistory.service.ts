import { prisma } from '../utils/prisma';

export type IMEIActionType = 'purchase' | 'repair' | 'refurbish' | 'sale' | 'transfer';

export const imeiHistoryService = {
  async record(imei: string, actionType: IMEIActionType, options?: { location?: string; userId?: string; referenceId?: string }) {
    return prisma.iMEIHistory.create({
      data: {
        imei,
        actionType,
        location: options?.location,
        userId: options?.userId,
        referenceId: options?.referenceId
      }
    });
  },

  async getHistory(imei: string, limit = 50) {
    return prisma.iMEIHistory.findMany({
      where: { imei },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }
};
