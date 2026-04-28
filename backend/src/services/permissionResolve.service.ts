import { prisma } from '../utils/prisma';

const ADMIN_ROLE_NAMES = new Set(['admin', 'SystemAdmin', 'SYSTEM_ADMIN']);

/** All permission codes for a role; admin-like roles receive every permission row. */
export async function resolvePermissionCodesForRole(roleId: string): Promise<string[]> {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
  if (!role) return [];
  if (ADMIN_ROLE_NAMES.has(role.name)) {
    const all = await prisma.permission.findMany({ select: { code: true } });
    return all.map((p) => p.code);
  }
  const rps = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: { select: { code: true } } },
  });
  return rps.map((rp) => rp.permission.code);
}
