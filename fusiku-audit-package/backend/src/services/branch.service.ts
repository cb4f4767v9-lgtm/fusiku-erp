import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';
import { saasPlanService } from './saasPlan.service';
import { syncCompanyUsage } from './companyUsage.service';

export const branchService = {
  async getAll(companyId?: string | null, restrictToBranchId?: string | null) {
    const where: any = { isActive: true };
    if (companyId) where.companyId = companyId;
    if (restrictToBranchId) where.id = restrictToBranchId;
    return prisma.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { contacts: true }
    });
  },

  async getById(id: string, restrictToBranchId?: string | null) {
    const companyId = requireTenantCompanyId();
    if (restrictToBranchId && restrictToBranchId !== id) return null;
    return prisma.branch.findFirst({
      where: { id, companyId },
      include: { contacts: true, _count: { select: { inventory: true, users: true } } }
    });
  },

  async create(data: {
    name: string;
    code?: string;
    adminName?: string;
    currency?: string;
    marginPercent?: number;
    defaultLanguage?: string;
    country?: string;
    province?: string;
    city?: string;
    address?: string;
    phone?: string;
    logo?: string | null;
    contacts?: { contactType: string; value: string }[];
  }) {
    const companyId = requireTenantCompanyId();
    await saasPlanService.assertCanAddBranch(companyId);
    const { contacts, companyId: _ignoredCompany, ...branchData } = data as typeof data & { companyId?: string };
    const branch = await prisma.branch.create({
      data: { ...branchData, companyId }
    });
    if (contacts?.length) {
      await prisma.branchContact.createMany({
        data: contacts.map((c) => ({ branchId: branch.id, contactType: c.contactType, value: c.value }))
      });
    }
    const out = await prisma.branch.findFirst({
      where: { id: branch.id, companyId },
      include: { contacts: true }
    })!;
    void syncCompanyUsage(companyId).catch(() => {});
    return out;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      code: string;
      adminName: string;
      currency: string;
      defaultLanguage: string;
      marginPercent: number;
      country: string;
      province: string;
      city: string;
      address: string;
      phone: string;
      logo: string | null;
      isActive: boolean;
      contacts: { contactType: string; value: string }[];
    }>
  ) {
    const companyId = requireTenantCompanyId();
    const { contacts, ...branchData } = data;
    if (contacts !== undefined) {
      await prisma.branchContact.deleteMany({
        where: { branchId: id, branch: { companyId } }
      });
      if (contacts.length) {
        await prisma.branchContact.createMany({
          data: contacts.map((c) => ({ branchId: id, contactType: c.contactType, value: c.value }))
        });
      }
    }
    const updated = await prisma.branch.updateMany({
      where: { id, companyId },
      data: branchData as any
    });
    if (updated.count === 0) return null;
    const next = await prisma.branch.findFirst({
      where: { id, companyId },
      include: { contacts: true }
    });
    void syncCompanyUsage(companyId).catch(() => {});
    return next;
  },

  async delete(id: string) {
    const companyId = requireTenantCompanyId();
    const r = await prisma.branch.updateMany({
      where: { id, companyId },
      data: { isActive: false }
    });
    void syncCompanyUsage(companyId).catch(() => {});
    return r;
  }
};
