import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { posService } from '../services/pos.service';
import { activityLogService } from '../services/activityLog.service';

export const posController = {
  async createSale(req: AuthRequest, res: Response) {
    try {
      const branchId = req.body.branchId || req.user?.branchId;
      if (!branchId) return res.status(400).json({ error: 'Branch ID required' });
      
      const sale = await posService.createSale({
        ...req.body,
        branchId,
        userId: req.user?.userId
      });
      await activityLogService.log({ userId: req.user?.userId, action: 'sale_completion', entityType: 'Sale', entityId: (sale as any).id });
      res.status(201).json(sale);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async getReceipt(req: AuthRequest, res: Response) {
    try {
      const receipt = await posService.getReceipt(req.params.id);
      if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
      res.json(receipt);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
