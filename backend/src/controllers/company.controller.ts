import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { companyService } from '../services/company.service';
import { prisma } from '../utils/prisma';

function resolveErrorStatus(error: unknown): { status: number; message: string } {
  const message =
    error instanceof Error
      ? error.message || 'Request failed'
      : typeof error === 'string' && error
        ? error
        : 'Request failed';
  const ext = error as { statusCode?: number; code?: string };
  if (ext.statusCode === 403) return { status: 403, message };
  if (ext.statusCode === 404) return { status: 404, message };
  if (ext.code === 'P2025') return { status: 404, message };
  const low = message.toLowerCase();
  if (message === 'Forbidden' || low.includes('forbidden')) return { status: 403, message };
  if (
    low.includes('tenant') ||
    low.includes('companyid') ||
    low.includes('system admin must specify')
  ) {
    return { status: 400, message };
  }
  return { status: 500, message };
}

export const companyController = {
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });
      const settings = await companyService.getSettings(companyId);
      if (!settings) return res.status(404).json({ error: 'Settings not found' });
      res.json(settings);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error);
      res.status(status).json({ error: message });
    }
  },

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });
      const settings = await companyService.upsertSettings(companyId, req.body);
      res.json(settings);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error);
      const outStatus = status === 500 ? 400 : status;
      res.status(outStatus).json({ error: message });
    }
  },

  async getProfile(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          logo: true,
          email: true,
          phone: true,
          address: true,
          businessType: true,
        },
      });

      if (!company) return res.status(404).json({ error: 'Company not found' });
      // Prefer per-tenant settings logo when present (keeps backward compatibility with Company.logo).
      const settings = await prisma.companySettings
        .findUnique({
          where: { companyId },
          select: { logo: true },
        })
        .catch(() => null as any);

      return res.status(200).json({
        ...company,
        logo: settings?.logo ?? company.logo ?? null,
      });
    } catch (error: unknown) {
      console.error('Company Profile Error:', error);
      const { status, message } = resolveErrorStatus(error);
      res.status(status).json({ error: message });
    }
  },

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const body = req.body || {};
      const profile = await companyService.updateProfile({
        name: body.name,
        logo: body.logo,
        email: body.email,
        phone: body.phone,
        address: body.address,
      });
      res.json(profile);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error);
      const outStatus = status === 500 ? 400 : status;
      res.status(outStatus).json({ error: message });
    }
  },
};
