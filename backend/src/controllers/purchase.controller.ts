import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { purchaseService } from '../services/purchase.service';
import { activityLogService } from '../services/activityLog.service';

export const purchaseController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const purchases = await purchaseService.getAll({ ...(req.query as any), companyId: req.user?.companyId });
      res.json(purchases);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const purchase = await purchaseService.getById(req.params.id);
      if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
      res.json(purchase);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const purchase = await purchaseService.create({ ...req.body, userId: req.user?.userId });
      await activityLogService.log({ userId: req.user?.userId, action: 'purchase_create', entityType: 'Purchase', entityId: purchase.id });
      res.status(201).json(purchase);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
