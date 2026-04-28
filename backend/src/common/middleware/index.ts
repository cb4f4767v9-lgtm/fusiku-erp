/** Shared HTTP middleware — re-export from legacy `middlewares/` during migration. */
export { authMiddleware, type AuthRequest } from '../../middlewares/auth.middleware';
export { tenantGuard, requireBranchContext } from '../../middlewares/tenantGuard.middleware';
