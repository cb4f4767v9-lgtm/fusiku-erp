/**
 * Integration logs controller
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { integrationLogService } from '../services/integrationLog.service';

export const integrationLogController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await integrationLogService.list(companyId || null, limit);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
