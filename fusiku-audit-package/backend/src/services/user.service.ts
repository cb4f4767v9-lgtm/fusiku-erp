import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma';
import { requireTenantCompanyId, isPlatformAdminRole } from '../utils/tenantContext';
import { saasPlanService } from './saasPlan.service';
import { syncCompanyUsage } from './companyUsage.service';

export const userService = {
  async getAll(companyId?: string | null) {
    const cid = typeof companyId === 'string' ? companyId.trim() : '';
    if (!cid) {
      const err = new Error('Tenant context required');
      (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const where: any = { companyId: cid };
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
    await saasPlanService.assertCanAddUser(companyId);
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (role && isPlatformAdminRole(role.name)) {
      throw new Error('Cannot assign platform administrator role');
    }
    const exists = await prisma.user.findFirst({ where: { email: data.email, companyId } });
    if (exists) throw new Error('Email already registered');

    const hashed = bcrypt.hashSync(data.password, 10);
    const created = await prisma.user.create({
      data: { ...data, companyId, password: hashed },
      include: { role: true, branch: true }
    });
    void syncCompanyUsage(companyId).catch(() => {});
    return created;
  },

  async update(id: string, data: Partial<{ name: string; roleId: string; branchId: string | null; isActive: boolean; password?: string }>) {
    const companyId = requireTenantCompanyId();
    const { password, ...rest } = data;
    const payload: any = { ...rest };
    if (password) payload.password = bcrypt.hashSync(password, 10);

    if (data.roleId) {
      const role = await prisma.role.findUnique({ where: { id: data.roleId } });
      if (role && isPlatformAdminRole(role.name)) {
        throw new Error('Cannot assign platform administrator role');
      }
    }

    const updated = await prisma.user.updateMany({
      where: { id, companyId },
      data: payload
    });
    if (updated.count === 0) return null;
    const out = await prisma.user.findFirst({
      where: { id, companyId },
      include: { role: true, branch: true }
    });
    void syncCompanyUsage(companyId).catch(() => {});
    return out;
  },

  async delete(id: string) {
    const companyId = requireTenantCompanyId();
    const n = await prisma.user.deleteMany({ where: { id, companyId } });
    void syncCompanyUsage(companyId).catch(() => {});
    return n;
  }
};
