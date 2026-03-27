import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from './auth.middleware';

export function requirePermission(...permissionCodes: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
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
