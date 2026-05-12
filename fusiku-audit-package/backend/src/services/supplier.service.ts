import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const supplierService = {
  async getAll() {
    const companyId = requireTenantCompanyId();
    return prisma.supplier.findMany({
      where: { isActive: true, companyId },
      orderBy: { name: 'asc' },
      include: { contacts: true },
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.supplier.findFirst({
      where: { id, companyId },
      include: { contacts: true, _count: { select: { purchases: true } } }
    });
  },

  async create(data: {
    name: string;
    currency?: string;
    companyName?: string;
    email?: string;
    website?: string;
    country: string;
    province?: string;
    city?: string;
    address?: string;
    openingBalance?: number;
    balanceType?: string;
    paymentMethod?: string;
    moneyStatus?: string;
    availableBalance?: number;
    blockedBalance?: number;
    contacts?: { contactType: string; value: string; qrCodeUrl?: string }[];
  }) {
    if (!data.country?.trim()) throw new Error('Country is required');
    const companyId = requireTenantCompanyId();
    const { contacts, companyId: _ignoredCompany, currency: currencyRaw, ...supplierData } = data as typeof data & {
      companyId?: string;
    };
    const currency =
      String(currencyRaw ?? 'USD')
        .trim()
        .toUpperCase()
        .slice(0, 8) || 'USD';

    const supplier = await prisma.supplier.create({
      data: {
        ...supplierData,
        currency,
        companyId,
        openingBalance: Number(supplierData.openingBalance ?? 0),
        balanceType: supplierData.balanceType || 'debit',
        availableBalance: Number(supplierData.availableBalance ?? 0),
        blockedBalance: Number(supplierData.blockedBalance ?? 0),
      },
    });
    if (contacts?.length) {
      await prisma.supplierContact.createMany({
        data: contacts.map((c) => ({ supplierId: supplier.id, contactType: c.contactType, value: c.value, qrCodeUrl: c.qrCodeUrl }))
      });
    }
    return prisma.supplier.findFirst({
      where: { id: supplier.id, companyId },
      include: { contacts: true }
    })!;
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      currency: string;
      companyName: string;
      email: string;
      website: string;
      country: string;
      province: string;
      city: string;
      address: string;
      openingBalance: number;
      balanceType: string;
      paymentMethod: string;
      moneyStatus: string;
      availableBalance: number;
      blockedBalance: number;
      isActive: boolean;
      contacts: { id?: string; contactType: string; value: string; qrCodeUrl?: string }[];
    }>
  ) {
    const companyId = requireTenantCompanyId();
    const { contacts, ...supplierData } = data;
    if (contacts !== undefined) {
      await prisma.supplierContact.deleteMany({
        where: { supplierId: id, supplier: { companyId } }
      });
      if (contacts.length) {
        await prisma.supplierContact.createMany({
          data: contacts.map((c) => ({ supplierId: id, contactType: c.contactType, value: c.value, qrCodeUrl: c.qrCodeUrl }))
        });
      }
    }
    const updateData: any = { ...supplierData };
    if (supplierData.availableBalance !== undefined) updateData.availableBalance = Number(supplierData.availableBalance);
    if (supplierData.blockedBalance !== undefined) updateData.blockedBalance = Number(supplierData.blockedBalance);
    if (supplierData.currency !== undefined) {
      updateData.currency =
        String(supplierData.currency)
          .trim()
          .toUpperCase()
          .slice(0, 8) || 'USD';
    }

    const updated = await prisma.supplier.updateMany({
      where: { id, companyId },
      data: updateData
    });
    if (updated.count === 0) return null;
    return prisma.supplier.findFirst({
      where: { id, companyId },
      include: { contacts: true }
    });
  },

  async delete(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.supplier.updateMany({
      where: { id, companyId },
      data: { isActive: false }
    });
  }
};
