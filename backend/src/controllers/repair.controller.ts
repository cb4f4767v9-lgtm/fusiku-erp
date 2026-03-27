import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { repairService } from '../services/repair.service';
import { activityLogService } from '../services/activityLog.service';

export const repairController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const repairs = await repairService.getAll({ ...(req.query as any), companyId: req.user?.companyId });
      res.json(repairs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const repair = await repairService.getById(req.params.id);
      if (!repair) return res.status(404).json({ error: 'Repair not found' });
      res.json(repair);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const repair = await repairService.create({ ...req.body, companyId: req.body.companyId || req.user?.companyId });
      await activityLogService.log({ userId: req.user?.userId, action: 'repair_create', entityType: 'Repair', entityId: repair.id });
      res.status(201).json(repair);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const repair = await repairService.update(req.params.id, req.body);
      if (!repair) return res.status(404).json({ error: 'Repair not found' });
      if (req.body.status === 'completed') {
        await activityLogService.log({ userId: req.user?.userId, action: 'repair_completion', entityType: 'Repair', entityId: repair.id });
      }
      res.json(repair);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
