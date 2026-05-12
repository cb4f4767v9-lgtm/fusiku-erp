import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { verifyToken } from '../utils/jwt';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

function normalizeRelativeUploadPath(raw: string): string | null {
  const s = String(raw || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!s || s.includes('..')) return null;
  if (!/^[a-zA-Z0-9_\-./]+$/.test(s)) return null;
  return s;
}

function resolveToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7).trim() || null;
  const q = String((req.query as { token?: string }).token || '').trim();
  return q || null;
}

function relativeFromRequestUrl(req: Request): string | null {
  const url = (req.originalUrl || req.url || '').split('?')[0];
  const m = url.match(/^\/uploads\/(.+)$/);
  return m ? normalizeRelativeUploadPath(m[1]) : null;
}

async function isPathAllowedForCompany(companyId: string, rel: string, publicUrl: string): Promise<boolean> {
  const variants = [rel, `/${rel}`, rel.replace(/^\//, '')];
  for (const p of variants) {
    const hit = await prisma.fileUpload.findFirst({
      where: { companyId, path: p },
      select: { id: true },
    });
    if (hit) return true;
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { logo: true },
  });
  if (company?.logo && (company.logo === publicUrl || company.logo.endsWith(rel))) return true;

  const settings = await prisma.companySettings.findFirst({
    where: { companyId },
    select: { logo: true },
  });
  if (settings?.logo && (settings.logo === publicUrl || settings.logo.endsWith(rel))) return true;

  const branchHit = await prisma.branch.findFirst({
    where: {
      companyId,
      OR: [{ logo: publicUrl }, { logo: { endsWith: rel } }],
    },
    select: { id: true },
  });
  return !!branchHit;
}

/**
 * Authenticated read for files under /uploads. Token: Authorization Bearer or ?token=
 */
export function secureUploadsMiddleware(req: Request, res: Response, _next: NextFunction) {
  void (async () => {
    try {
      const token = resolveToken(req);
      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      const companyId = payload.companyId;
      if (!companyId && !payload.isSystemAdmin) {
        res.status(403).json({ error: 'Tenant context required' });
        return;
      }

      const rel = relativeFromRequestUrl(req);
      if (!rel) {
        res.status(400).json({ error: 'Invalid path' });
        return;
      }

      const abs = path.resolve(UPLOAD_ROOT, rel);
      if (!abs.startsWith(path.resolve(UPLOAD_ROOT))) {
        res.status(400).json({ error: 'Invalid path' });
        return;
      }

      const publicUrl = `/uploads/${rel.replace(/\\/g, '/')}`;

      if (companyId) {
        const ok = await isPathAllowedForCompany(companyId, rel, publicUrl);
        if (!ok) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
      } else if (payload.isSystemAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      res.sendFile(abs, (err) => {
        if (err && !res.headersSent) {
          res.status(500).end();
        }
      });
    } catch {
      if (!res.headersSent) res.status(500).json({ error: 'Failed to serve file' });
    }
  })();
}
