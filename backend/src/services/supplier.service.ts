import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const supplierService = {
  async getAll(companyId?: string | null) {
    const where: any = { isActive: true };
    if (companyId) where.companyId = companyId;
    return prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { contacts: true }
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
    companyId?: string;
    contacts?: { contactType: string; value: string; qrCodeUrl?: string }[];
  }) {
    if (!data.country?.trim()) throw new Error('Country is required');
    const companyId = data.companyId ?? requireTenantCompanyId();
    const { contacts, ...supplierData } = data;
    const supplier = await prisma.supplier.create({
      data: {
        ...supplierData,
        companyId,
        openingBalance: Number(supplierData.openingBalance ?? 0),
        balanceType: supplierData.balanceType || 'debit',
        availableBalance: Number(supplierData.availableBalance ?? 0),
        blockedBalance: Number(supplierData.blockedBalance ?? 0)
      }
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
