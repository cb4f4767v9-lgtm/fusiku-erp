import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { isPlatformAdminRole } from '../utils/tenantContext';

/**
 * /api/v1/system/* — authenticated users only, plus an elevated role
 * (company Admin or platform SystemAdmin). Keeps DB version / metrics
 * out of anonymous hands while allowing the Monitoring page for admins.
 */
export function requireSystemDiagnosticsRole(req: AuthRequest, res: Response, next: NextFunction) {
  const roleName = req.user?.roleName;
  if (req.user?.isSystemAdmin) {
    return next();
  }
  if (roleName && isPlatformAdminRole(roleName)) {
    return next();
  }
  const n = (roleName || '').trim().toLowerCase();
  if (n === 'admin' || n === 'administrator' || n === 'systemadmin') {
    return next();
  }
  return res.status(403).json({ error: 'Insufficient permissions for system diagnostics.' });
}
