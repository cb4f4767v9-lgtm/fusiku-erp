import { prisma } from '../utils/prisma';

export const activityLogService = {
  async log(data: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
  }) {
    return prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId
      }
    });
  },

  async getAll(filters?: {
    userId?: string;
    entityType?: string;
    limit?: number;
    companyId?: string;
    isSystemAdmin?: boolean;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.companyId) {
      where.user = { companyId: filters.companyId };
    } else {
      return [];
    }

    return prisma.activityLog.findMany({
      where,
      include: { user: true },
      orderBy: { timestamp: 'desc' },
      take: Math.min(filters?.limit || 100, 500)
    });
  }
};
