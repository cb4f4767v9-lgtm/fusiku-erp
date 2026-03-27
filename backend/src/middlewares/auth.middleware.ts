import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isPlatformAdminRole, runWithTenantContext } from '../utils/tenantContext';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roleId: string;
    roleName?: string;
    companyId?: string;
    branchId?: string;
    isSystemAdmin?: boolean;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const payload = verifyToken(token);
    const isSystemAdmin =
      payload.isSystemAdmin === true ||
      isPlatformAdminRole(payload.roleName);
    if (!payload?.companyId && !isSystemAdmin) {
      return res.status(403).json({ error: 'Tenant context missing (companyId). Please sign in again.' });
    }
    req.user = payload;
    return runWithTenantContext(
      {
        userId: payload.userId,
        companyId: payload.companyId ?? '',
        branchId: payload.branchId,
        isSystemAdmin,
      },
      () => next()
    );
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function roleMiddleware(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.roleId)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
