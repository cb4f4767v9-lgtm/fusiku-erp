import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const customerService = {
  async getAll(companyId?: string | null) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { contacts: true }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.customer.findFirst({
      where: { id, companyId },
      include: { contacts: true, sales: true, repairs: true }
    });
  },

  async create(data: {
    name: string;
    companyName?: string;
    email?: string;
    website?: string;
    phone?: string;
    country?: string;
    province?: string;
    city?: string;
    address?: string;
    openingBalance?: number;
    balanceType?: string;
    paymentMethod?: string;
    moneyStatus?: string;
    companyId?: string;
    contacts?: { contactType: string; value: string; qrCodeUrl?: string }[];
  }) {
    const companyId = data.companyId ?? requireTenantCompanyId();
    const { contacts, ...customerData } = data;
    const customer = await prisma.customer.create({
      data: {
        ...customerData,
        companyId,
        openingBalance: Number(customerData.openingBalance ?? 0),
        balanceType: customerData.balanceType || 'debit'
      }
    });
    if (contacts?.length) {
      await prisma.customerContact.createMany({
        data: contacts.map((c) => ({ customerId: customer.id, contactType: c.contactType, value: c.value, qrCodeUrl: c.qrCodeUrl }))
      });
    }
    return prisma.customer.findFirst({
      where: { id: customer.id, companyId },
      include: { contacts: true }
    })!;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      companyName: string;
      email: string;
      website: string;
      phone: string;
      country: string;
      province: string;
      city: string;
      address: string;
      openingBalance: number;
      balanceType: string;
      paymentMethod: string;
      moneyStatus: string;
      contacts: { id?: string; contactType: string; value: string; qrCodeUrl?: string }[];
    }>
  ) {
    const companyId = requireTenantCompanyId();
    const { contacts, ...customerData } = data;
    if (contacts !== undefined) {
      await prisma.customerContact.deleteMany({
        where: { customerId: id, customer: { companyId } }
      });
      if (contacts.length) {
        await prisma.customerContact.createMany({
          data: contacts.map((c) => ({ customerId: id, contactType: c.contactType, value: c.value, qrCodeUrl: c.qrCodeUrl }))
        });
      }
    }
    const updated = await prisma.customer.updateMany({
      where: { id, companyId },
      data: customerData as any
    });
    if (updated.count === 0) return null;
    return prisma.customer.findFirst({
      where: { id, companyId },
      include: { contacts: true }
    });
  },

  async delete(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.customer.deleteMany({ where: { id, companyId } });
  }
};
