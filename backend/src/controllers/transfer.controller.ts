import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { transferService } from '../services/transfer.service';
import { activityLogService } from '../services/activityLog.service';

export const transferController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const transfers = await transferService.getAll(req.query as any);
      res.json(transfers);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const transfer = await transferService.getById(req.params.id);
      if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
      res.json(transfer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const transfer = await transferService.create({
        ...req.body,
        createdById: userId
      });
      res.status(201).json(transfer);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async approve(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const transfer = await transferService.approve(req.params.id, userId);
      if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
      await activityLogService.log({ userId, action: 'transfer_approval', entityType: 'Transfer', entityId: transfer.id });
      res.json(transfer);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
