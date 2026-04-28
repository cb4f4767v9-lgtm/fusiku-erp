import { prisma } from '../utils/prisma';
import { runWithTenantContext } from '../utils/tenantContext';

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function syncCompanyUsageInner(companyId: string): Promise<void> {
  const now = new Date();
  const monthStart = startOfUtcMonth(now);

  const [activeUsers, activeBranches, inventoryCount, salesCountMonthly] = await Promise.all([
    prisma.user.count({ where: { companyId, isActive: true } }),
    prisma.branch.count({ where: { companyId, isActive: true } }),
    prisma.inventory.count({ where: { companyId } }),
    prisma.sale.count({
      where: {
        companyId,
        createdAt: { gte: monthStart },
      },
    }),
  ]);

  await (prisma as any).companyUsage.upsert({
    where: { companyId },
    create: {
      companyId,
      activeUsers,
      activeBranches,
      inventoryCount,
      salesCountMonthly,
    },
    update: {
      activeUsers,
      activeBranches,
      inventoryCount,
      salesCountMonthly,
    },
  });
}

/**
 * Recomputes cached usage from source tables (idempotent).
 * Call after user / branch / sale events (Phase 4.1).
 */
export async function syncCompanyUsage(companyId: string): Promise<void> {
  return runWithTenantContext(
    { userId: 'company_usage_sync', companyId, isSystemAdmin: false },
    () => syncCompanyUsageInner(companyId)
  );
}

export const companyUsageService = {
  syncCompanyUsage,

  async getUsage(companyId: string) {
    await syncCompanyUsage(companyId).catch(() => {});
    return runWithTenantContext(
      { userId: 'company_usage_read', companyId, isSystemAdmin: false },
      () => (prisma as any).companyUsage.findUnique({ where: { companyId } })
    );
  },
};
