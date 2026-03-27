import { prisma } from '../utils/prisma';

/** Startup checks (JWT / DB env hints) */
export const auditSystem = () => {
  console.log('Running system audit...');
  if (!process.env.JWT_SECRET) console.warn('JWT missing');
  if (!process.env.DATABASE_URL) console.warn('Database missing');
};

/** Audit log API (used by audit routes) */
export const auditService = {
  async getAll(query: Record<string, unknown>) {
    const { entity, userId, limit } = query;
    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const take = Math.min(Number(limit) || 100, 500);

    return prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take
    });
  }
};
