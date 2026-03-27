import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const companyService = {
  async getAll() {
    return prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  },

  /** Only returns the tenant's own company row. */
  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    if (id !== companyId) return null;
    return prisma.company.findFirst({
      where: { id: companyId },
      include: { companySettings: true }
    });
  },

  async getSettings(companyId: string) {
    const tenantId = requireTenantCompanyId();
    if (companyId !== tenantId) throw new Error('Forbidden');
    return prisma.companySettings.findFirst({
      where: { companyId: tenantId }
    });
  },

  async upsertSettings(companyId: string, data: { currency?: string; timezone?: string; taxRate?: number; invoicePrefix?: string; logo?: string }) {
    const tenantId = requireTenantCompanyId();
    if (companyId !== tenantId) throw new Error('Forbidden');
    return prisma.companySettings.upsert({
      where: { companyId: tenantId },
      update: data,
      create: { companyId: tenantId, ...data }
    });
  }
};
