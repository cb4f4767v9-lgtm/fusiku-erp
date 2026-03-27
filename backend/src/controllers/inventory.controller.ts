import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { inventoryService } from '../services/inventory.service';
import { activityLogService } from '../services/activityLog.service';

export const inventoryController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const inventory = await inventoryService.getAll({ ...(req.query as any), companyId: req.user?.companyId });
      res.json(inventory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getByImei(req: AuthRequest, res: Response) {
    try {
      const item = await inventoryService.getByImei(req.params.imei);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getByBarcode(req: AuthRequest, res: Response) {
    try {
      const item = await inventoryService.getByBarcode(req.params.barcode);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const item = await inventoryService.create(req.body);
      await activityLogService.log({ userId: req.user?.userId, action: 'inventory_create', entityType: 'Inventory', entityId: item.id });
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const item = await inventoryService.update(req.params.id, req.body);
      await activityLogService.log({ userId: req.user?.userId, action: 'inventory_edit', entityType: 'Inventory', entityId: item.id });
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await inventoryService.delete(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
