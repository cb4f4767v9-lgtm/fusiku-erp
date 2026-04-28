import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { branchService } from '../services/branch.service';

function resolveErrorStatus(error: unknown, defaultServerStatus: number): { status: number; message: string } {
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
  if (
    low.includes('tenant') ||
    low.includes('companyid') ||
    low.includes('system admin must specify')
  ) {
    return { status: 400, message };
  }
  return { status: defaultServerStatus, message };
}

export const branchController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      if (!String(req.user?.companyId || '').trim()) {
        return res.json([]);
      }
      const branches = await branchService.getAll(req.user?.companyId, req.user?.branchId ?? null);
      res.json(branches);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 500);
      res.status(status).json({ error: message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const branch = await branchService.getById(req.params.id, req.user?.branchId ?? null);
      if (!branch) return res.status(404).json({ error: 'Branch not found' });
      res.json(branch);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 500);
      res.status(status).json({ error: message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      if (!String(req.user?.companyId || '').trim()) {
        return res.status(400).json({ error: 'Tenant context missing (companyId)' });
      }
      const branch = await branchService.create({ ...req.body, companyId: req.user?.companyId });
      res.status(201).json(branch);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 400);
      const outStatus = status === 500 ? 400 : status;
      res.status(outStatus).json({ error: message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const branch = await branchService.update(req.params.id, req.body);
      if (!branch) return res.status(404).json({ error: 'Branch not found' });
      res.json(branch);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 400);
      const outStatus = status === 500 ? 400 : status;
      res.status(outStatus).json({ error: message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await branchService.delete(req.params.id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 500);
      res.status(status).json({ error: message });
    }
  },
};
