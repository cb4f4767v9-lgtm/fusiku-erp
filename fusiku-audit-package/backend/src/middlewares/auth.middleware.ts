import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isPlatformAdminRole, runTenantContextForHttpRequest } from '../utils/tenantContext';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: any;
}

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

async function resolveDevTenantFallback(): Promise<{ companyId: string; branchId?: string } | null> {
  const companyId = String(process.env.DEV_COMPANY_ID || '').trim();
  const branchId = String(process.env.DEV_BRANCH_ID || '').trim();
  if (!companyId) return null;

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) return null;

  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId },
      select: { id: true },
    });
    if (!branch) return null;
    return { companyId, branchId };
  }

  return { companyId };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn({ ip: req.ip }, 'No token provided');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const payload = verifyToken(token);

    const isSystemAdmin =
      payload.isSystemAdmin === true ||
      isPlatformAdminRole(payload.roleName);

    const companyId =
      typeof payload.companyId === 'string' && payload.companyId.trim()
        ? payload.companyId.trim()
        : undefined;

    const branchId =
      typeof payload.branchId === 'string' && payload.branchId.trim()
        ? payload.branchId.trim()
        : undefined;

    let effectiveCompanyId = companyId;
    let effectiveBranchId = branchId;

    // Dev-only fallback to a REAL seeded tenant (never invent IDs).
    if (!effectiveCompanyId && !isSystemAdmin && isDev()) {
      const dev = await resolveDevTenantFallback();
      if (dev) {
        effectiveCompanyId = dev.companyId;
        effectiveBranchId = dev.branchId ?? effectiveBranchId;
      }
    }

    // No fake tenants: if tenant missing (and not system admin), block clearly.
    if (!effectiveCompanyId && !isSystemAdmin) {
      return res.status(401).json({
        error: 'Tenant context missing: token has no companyId',
        code: 'TENANT_MISSING',
        hint:
          isDev()
            ? 'In development, set DEV_COMPANY_ID (and optional DEV_BRANCH_ID) to an existing seeded tenant.'
            : undefined,
      });
    }

    req.user = {
      ...payload,
      ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      isSystemAdmin,
    };

    runTenantContextForHttpRequest(
      {
        userId: payload.userId,
        ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        branchRole: payload.branchRole,
        isSystemAdmin,
      },
      res,
      next
    );

  } catch (err) {
    logger.warn({ ip: req.ip }, 'Invalid token');
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}