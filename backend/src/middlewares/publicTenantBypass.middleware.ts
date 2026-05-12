import type { NextFunction, Request, Response } from 'express';
import { runTenantContextForHttpRequest } from '../utils/tenantContext';

/**
 * Public endpoints (signup/login/register/etc.) still need an AsyncLocalStorage tenant context
 * so Prisma middlewares can run. We bind a minimal "public" context that intentionally omits
 * `companyId`, and marks the request as system-admin-like for isolation bypass.
 *
 * This MUST only be used on explicitly public routes.
 */
export function publicTenantBypass(_req: Request, res: Response, next: NextFunction) {
  // When mounted (e.g. `app.use('/api/v1/signup', publicTenantBypass, signupRoutes)`),
  // `req.path` becomes `'/'`, which breaks public-route detection inside Prisma middleware.
  // `originalUrl` preserves the full path prefix (minus host), which we need for bypass allowlisting.
  const requestPath = String(_req.originalUrl || _req.baseUrl || _req.path || '').split('?')[0] || undefined;
  runTenantContextForHttpRequest(
    {
      userId: 'public',
      isSystemAdmin: true,
      requestPath,
    },
    res,
    next
  );
}

