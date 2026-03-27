import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { auditService } from '../services/audit.service';

export const auditController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const logs = await auditService.getAll(req.query as any);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
