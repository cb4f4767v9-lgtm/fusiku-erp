import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { saasPlanService } from '../services/saasPlan.service';
import type { PlanFeatureKey } from '../services/saasPlan.service';

/**
 * Requires JWT tenant context and an enabled boolean on the company's current plan `features` JSON.
 * Platform admins bypass (cross-tenant operations).
 */
export function requireFeature(feature: PlanFeatureKey) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Temporary escape hatch for “make it work now” environments.
      // Keeps routes and feature checks in place, but avoids hard-blocking core UX.
      const disable = String(process.env.DISABLE_SAAS_FEATURE_GATES || '')
        .trim()
        .toLowerCase();
      if (disable === '1' || disable === 'true' || disable === 'yes') return next();

      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: 'Tenant context missing' });
      }
      const ok = await saasPlanService.companyHasFeature(companyId, feature);
      if (!ok) {
        return res.status(403).json({
          error: `This action requires the "${feature}" capability on your subscription plan.`,
          code: 'FEATURE_NOT_INCLUDED',
          feature,
        });
      }
      next();
    } catch (e: any) {
      res.status(403).json({ error: e?.message || 'Plan check failed' });
    }
  };
}
