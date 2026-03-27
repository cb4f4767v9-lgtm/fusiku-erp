import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { refurbishService } from '../services/refurbish.service';

export const refurbishController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const jobs = await refurbishService.getAll(req.query as any);
      res.json(jobs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const job = await refurbishService.getById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const job = await refurbishService.create(req.body);
      res.status(201).json(job);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const job = await refurbishService.update(req.params.id, req.body);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
