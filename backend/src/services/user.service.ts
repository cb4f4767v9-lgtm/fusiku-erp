import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

export const userService = {
  async getAll(companyId?: string | null) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return prisma.user.findMany({
      where,
      include: { role: true, branch: true } as any,
      orderBy: { createdAt: 'desc' }
    });
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.user.findFirst({
      where: { id, companyId },
      include: { role: true, branch: true }
    });
  },

  async create(data: { email: string; password: string; name: string; roleId: string; companyId?: string; branchId?: string }) {
    const companyId = data.companyId ?? requireTenantCompanyId();
    const exists = await prisma.user.findFirst({ where: { email: data.email, companyId } });
    if (exists) throw new Error('Email already registered');

    const hashed = bcrypt.hashSync(data.password, 10);
    return prisma.user.create({
      data: { ...data, companyId, password: hashed },
      include: { role: true, branch: true }
    });
  },

  async update(id: string, data: Partial<{ name: string; roleId: string; branchId: string | null; isActive: boolean; password?: string }>) {
    const companyId = requireTenantCompanyId();
    const { password, ...rest } = data;
    const payload: any = { ...rest };
    if (password) payload.password = bcrypt.hashSync(password, 10);

    const updated = await prisma.user.updateMany({
      where: { id, companyId },
      data: payload
    });
    if (updated.count === 0) return null;
    return prisma.user.findFirst({
      where: { id, companyId },
      include: { role: true, branch: true }
    });
  },

  async delete(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.user.deleteMany({ where: { id, companyId } });
  }
};
