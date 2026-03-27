import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { activityLogService } from '../services/activityLog.service';

export const activityLogController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const logs = await activityLogService.getAll(req.query as any);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
