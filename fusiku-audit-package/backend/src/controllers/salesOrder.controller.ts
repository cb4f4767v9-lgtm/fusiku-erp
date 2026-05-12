import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { salesOrderService } from '../services/salesOrder.service';

export const salesOrderController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const orders = await salesOrderService.list({
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as string | undefined,
        q: req.query.q as string | undefined,
        take: req.query.take != null ? Number(req.query.take) : undefined,
        skip: req.query.skip != null ? Number(req.query.skip) : undefined,
      });
      return res.json({ success: true, data: orders });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const order = await salesOrderService.getById(req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });
      return res.json({ success: true, data: order });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const branchId = req.body.branchId || req.user?.branchId;
      if (!branchId) return res.status(400).json({ success: false, message: 'Branch ID required' });

      const order = await salesOrderService.create({
        ...req.body,
        branchId,
        userId: req.user?.userId,
      });
      return res.status(201).json({ success: true, data: order });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const order = await salesOrderService.update(req.params.id, req.body);
      return res.json({ success: true, data: order });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },

  async confirm(req: AuthRequest, res: Response) {
    try {
      const order = await salesOrderService.confirm(req.params.id);
      return res.json({ success: true, data: order });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },

  async convertToInvoice(req: AuthRequest, res: Response) {
    try {
      const out = await salesOrderService.convertToInvoice(req.params.id, {
        userId: req.user?.userId,
        notes: req.body?.notes,
      });
      return res.status(201).json({ success: true, data: out });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },
};

