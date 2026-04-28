import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

/** Startup checks (JWT / DB env hints) */
export const auditSystem = () => {
  logger.info('[audit] System audit');
  if (!process.env.JWT_SECRET) logger.warn('[audit] JWT_SECRET is not set');
  if (!process.env.DATABASE_URL) logger.warn('[audit] DATABASE_URL is not set');
};

/** Audit log API (used by audit routes) */
export const auditService = {
  async getAll(
    query: Record<string, unknown>,
    scope?: { companyId?: string; isSystemAdmin?: boolean }
  ) {
    const { entity, userId, limit } = query;
    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    if (!scope?.isSystemAdmin && scope?.companyId) {
      where.user = { companyId: scope.companyId };
    }

    const take = Math.min(Number(limit) || 100, 500);

    return prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take
    });
  }
};
