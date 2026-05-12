import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { customerService } from '../services/customer.service';

export const customerController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const customers = await customerService.getAll(req.user?.companyId);
      res.json(customers);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const customer = await customerService.getById(req.params.id);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json(customer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const customer = await customerService.create({ ...req.body, companyId: req.user?.companyId });
      res.status(201).json(customer);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const customer = await customerService.update(req.params.id, req.body);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json(customer);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await customerService.delete(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
