import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { activityLogService } from '../services/activityLog.service';

export const activityLogController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const q = req.query as Record<string, unknown>;
      const logs = await activityLogService.getAll({
        userId: q.userId as string | undefined,
        entityType: q.entityType as string | undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        companyId: req.user?.companyId,
        isSystemAdmin: req.user?.isSystemAdmin,
      });
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
