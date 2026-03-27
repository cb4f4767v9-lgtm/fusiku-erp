import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const branchService = {
  async getAll(companyId?: string | null) {
    const where: any = { isActive: true };
    if (companyId) where.companyId = companyId;
    return prisma.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { contacts: true }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
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
    country?: string;
    province?: string;
    city?: string;
    address?: string;
    phone?: string;
    companyId?: string;
    contacts?: { contactType: string; value: string }[];
  }) {
    const companyId = data.companyId ?? requireTenantCompanyId();
    const { contacts, ...branchData } = data;
    const branch = await prisma.branch.create({
      data: { ...branchData, companyId }
    });
    if (contacts?.length) {
      await prisma.branchContact.createMany({
        data: contacts.map((c) => ({ branchId: branch.id, contactType: c.contactType, value: c.value }))
      });
    }
    return prisma.branch.findFirst({
      where: { id: branch.id, companyId },
      include: { contacts: true }
    })!;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      code: string;
      adminName: string;
      currency: string;
      country: string;
      province: string;
      city: string;
      address: string;
      phone: string;
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
    return prisma.branch.findFirst({
      where: { id, companyId },
      include: { contacts: true }
    });
  },

  async delete(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.branch.updateMany({
      where: { id, companyId },
      data: { isActive: false }
    });
  }
};
