/**
 * API Key authentication for public API
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { runTenantContextForHttpRequest } from '../utils/tenantContext';

export interface ApiKeyRequest extends Request {
  apiKey?: { id: string; companyId: string; permissions: string[] };
}

export async function apiKeyMiddleware(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (!key) {
    return res.status(401).json({ error: 'API key required. Provide via X-API-Key header or Authorization: Bearer <key>' });
  }
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { key, company: { isActive: true } },
      include: { company: true }
    });
    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    await prisma.apiKey.updateMany({
      where: { id: apiKey.id, companyId: apiKey.companyId },
      data: { lastUsedAt: new Date() }
    });
    const permissions = (() => {
      try {
        return typeof apiKey.permissions === 'string' ? (JSON.parse(apiKey.permissions) as string[]) : [];
      } catch {
        return [];
      }
    })();
    req.apiKey = { id: apiKey.id, companyId: apiKey.companyId, permissions };
    runTenantContextForHttpRequest(
      {
        userId: `apikey:${apiKey.id}`,
        companyId: apiKey.companyId,
        isSystemAdmin: false,
      },
      res,
      next
    );
  } catch {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requirePermission(...perms: string[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) return res.status(401).json({ error: 'Unauthorized' });
    const hasAll = perms.every(p => req.apiKey!.permissions.includes(p));
    if (!hasAll) {
      return res.status(403).json({ error: `Missing required permission(s): ${perms.join(', ')}` });
    }
    next();
  };
}
