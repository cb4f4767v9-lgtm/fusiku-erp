import { prisma } from '../utils/prisma';
import { prismaPlatform } from '../utils/prismaPlatform';
import { webhookService } from './webhook.service';
import { requireTenantCompanyId, runWithTenantContext } from '../utils/tenantContext';

const LOW_STOCK_THRESHOLD = 3;

export const stockAlertService = {
  async checkAndCreateAlerts() {
    const companies = await prismaPlatform.company.findMany({ select: { id: true } });
    const allAlerts: unknown[] = [];

    for (const c of companies) {
      await runWithTenantContext(
        { userId: 'job_low_stock', companyId: c.id, isSystemAdmin: false },
        async () => {
          const groups = await prisma.inventory.groupBy({
            by: ['brand', 'model', 'storage', 'branchId'],
            where: { status: 'available' },
            _count: { id: true },
          });

          for (const g of groups) {
            if (g._count.id < LOW_STOCK_THRESHOLD) {
              const branch = await prisma.branch.findFirst({
                where: { id: g.branchId },
                select: { companyId: true },
              });
              const existing = await prisma.stockAlert.findFirst({
                where: {
                  brand: g.brand,
                  model: g.model,
                  storage: g.storage || '',
                  companyId: branch?.companyId,
                  isRead: false,
                },
              });
              if (!existing) {
                const alert = await prisma.stockAlert.create({
                  data: {
                    type: 'low_stock',
                    companyId: branch?.companyId,
                    brand: g.brand,
                    model: g.model,
                    storage: g.storage,
                    message: `Low stock for ${g.brand} ${g.model} ${g.storage || ''}`.trim(),
                    count: g._count.id,
                    threshold: LOW_STOCK_THRESHOLD,
                  },
                });
                allAlerts.push(alert);
                if (branch?.companyId) {
                  webhookService
                    .dispatch(branch.companyId, 'low_stock.alert', {
                      brand: g.brand,
                      model: g.model,
                      storage: g.storage,
                      count: g._count.id,
                      threshold: LOW_STOCK_THRESHOLD,
                    })
                    .catch(() => {});
                }
              }
            }
          }
        }
      );
    }

    return allAlerts;
  },

  async getAlerts(companyId?: string | null) {
    const where: any = { isRead: false };
    if (companyId) where.companyId = companyId;
    return prisma.stockAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async markRead(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.stockAlert.updateMany({
      where: { id, companyId },
      data: { isRead: true },
    });
  },
};
