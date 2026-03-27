import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { branchService } from '../services/branch.service';

export const branchController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const branches = await branchService.getAll(req.user?.companyId);
      res.json(branches);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const branch = await branchService.getById(req.params.id);
      if (!branch) return res.status(404).json({ error: 'Branch not found' });
      res.json(branch);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const branch = await branchService.create({ ...req.body, companyId: req.body.companyId || req.user?.companyId });
      res.status(201).json(branch);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const branch = await branchService.update(req.params.id, req.body);
      if (!branch) return res.status(404).json({ error: 'Branch not found' });
      res.json(branch);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await branchService.delete(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
