import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from './auth.middleware';
import { isPlatformAdminRole } from '../utils/tenantContext';

export function requirePermission(...permissionCodes: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    if (req.user.branchRole === 'SUPER_ADMIN') {
      return next();
    }

    const path = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+/g, '/');
    const isPlatformRoute = /\/v1\/admin(\/|$)/.test(path) || /^\/api\/v1\/admin(\/|$)/.test(path);
    if (isPlatformRoute && (req.user.isSystemAdmin || isPlatformAdminRole(req.user.roleName))) {
      return next();
    }

    try {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId: req.user.roleId },
        include: { permission: true }
      });
      const userPermissions = rolePermissions.map((rp) => rp.permission.code);

      const hasPermission = permissionCodes.some((code) => userPermissions.includes(code));
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions.' });
      }
      next();
    } catch (e) {
      return res.status(500).json({ error: 'Permission check failed.' });
    }
  };
}
