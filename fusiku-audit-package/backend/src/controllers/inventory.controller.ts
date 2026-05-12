import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { assertBranchQueryAllowed } from '../core/auth/branchGuard';
import { inventoryService } from '../services/inventory.service';
import { activityLogService } from '../services/activityLog.service';
import type { z } from 'zod';
import { inventoryListQuerySchema } from '../core/validation/schemas/inventory.schemas';

type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;

export const inventoryController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const vq = (req as AuthRequest & { validatedQuery?: InventoryListQuery }).validatedQuery;
      const branchId = assertBranchQueryAllowed(
        req.user,
        vq?.branchId ?? (req.query.branchId as string | undefined)
      );
      const inventory = await inventoryService.list({
        ...(vq ?? req.query),
        branchId,
        companyId: req.user?.companyId,
      });
      res.json(inventory);
    } catch (e: any) {
      const code = e?.statusCode === 403 ? 403 : 500;
      res.status(code).json({ error: e.message });
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

  async pricingContext(req: AuthRequest, res: Response) {
    try {
      const imeisRaw = String((req.query.imeis as any) || '');
      const imeis = imeisRaw
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const ctx = await inventoryService.getPricingContextByImeis(imeis);
      res.json(ctx);
    } catch (e: any) {
      // safe: return empty map, never break UI
      res.json({});
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
      const id =
        (req as AuthRequest & { validatedParams?: { id: string } }).validatedParams?.id ?? req.params.id;
      const item = await inventoryService.update(id, req.body);
      await activityLogService.log({ userId: req.user?.userId, action: 'inventory_edit', entityType: 'Inventory', entityId: item.id });
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const id =
        (req as AuthRequest & { validatedParams?: { id: string } }).validatedParams?.id ?? req.params.id;
      await inventoryService.delete(id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
