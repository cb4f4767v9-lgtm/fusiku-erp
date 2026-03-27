import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supplierService } from '../services/supplier.service';

export const supplierController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const suppliers = await supplierService.getAll(req.user?.companyId);
      res.json(suppliers);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
      res.json(supplier);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const supplier = await supplierService.create({ ...req.body, companyId: req.body.companyId || req.user?.companyId });
      res.status(201).json(supplier);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
      res.json(supplier);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await supplierService.delete(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
