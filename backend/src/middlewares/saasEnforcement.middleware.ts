import type { Request, Response, NextFunction } from 'express';
import { getTenantContext } from '../utils/tenantContext';
import { saasPlanService } from '../services/saasPlan.service';

/**
 * Reserved for subscription / plan enforcement after `tenantGuard`.
 * Intentionally a no-op until SaaS rules are wired; keeps the middleware chain stable.
 */
function enabled(): boolean {
  // Keep default behavior unchanged unless explicitly enabled.
  return process.env.SAAS_ENFORCEMENT === '1';
}

function isReadOnly(req: Request): boolean {
  return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
}

function isCommercialWritePath(path: string): boolean {
  // Block operational writes first; keep admin/company/meta flows available to let customers upgrade.
  const p = path.replace(/\/+/g, '/');
  return (
    /^\/api\/v1\/(pos|purchases|inventory|sales-orders|invoices|repairs|refurbish|transfers|expenses|stock-movements|payments)(\/|$)/.test(
      p
    ) || /^\/api\/v1\/ai(\/|$)/.test(p)
  );
}

export const saasEnforcementMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!enabled()) return next();

    const ctx = getTenantContext();
    if (!ctx) return next(); // tenantGuard handles this; keep chain stable
    if (ctx.isSystemAdmin) return next();
    if (!ctx.companyId) return next();

    const overlay = await saasPlanService.getProfileSaasOverlay(ctx.companyId);

    // Attach for downstream controllers (non-breaking: optional).
    (req as any).saas = overlay;

    if (overlay.hardExpired && !isReadOnly(req)) {
      return res.status(402).json({
        error: 'Subscription expired. Upgrade to continue.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
    }

    // Trial ended: allow reads + non-commercial writes, block commercial ops.
    if (overlay.trialCommercialLock && !isReadOnly(req) && isCommercialWritePath(req.originalUrl || req.url)) {
      return res.status(402).json({
        error: 'Trial ended. Upgrade to continue commercial operations.',
        code: 'TRIAL_COMMERCIAL_LOCK',
      });
    }

    next();
  } catch (e: any) {
    // Fail closed only when enforcement is enabled, but keep error explicit.
    return res.status(403).json({
      error: e?.message || 'SaaS enforcement failed',
      code: 'SAAS_ENFORCEMENT_FAILED',
    });
  }
};
