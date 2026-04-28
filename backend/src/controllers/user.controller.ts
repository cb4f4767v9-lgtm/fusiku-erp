import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { userService } from '../services/user.service';

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

export const userController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      }
      const users = await userService.getAll(req.user.companyId);
      res.json(users);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 500);
      res.status(status).json({ error: message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const user = await userService.getById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 500);
      res.status(status).json({ error: message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const isPlatform = !!req.user?.isSystemAdmin;
      const companyId = isPlatform
        ? String(req.body?.companyId || '').trim() || undefined
        : req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: 'companyId is required' });
      }
      const { companyId: _ignored, ...rest } = req.body || {};
      const user = await userService.create({ ...rest, companyId });
      res.status(201).json(user);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 400);
      const outStatus = status === 500 ? 400 : status;
      res.status(outStatus).json({ error: message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const user = await userService.update(req.params.id, req.body);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 400);
      const outStatus = status === 500 ? 400 : status;
      res.status(outStatus).json({ error: message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await userService.delete(req.params.id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('ERROR:', error);
      const { status, message } = resolveErrorStatus(error, 500);
      res.status(status).json({ error: message });
    }
  },
};
