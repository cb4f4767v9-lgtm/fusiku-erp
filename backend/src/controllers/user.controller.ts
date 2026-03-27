import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { userService } from '../services/user.service';

export const userController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const users = await userService.getAll(req.user?.companyId);
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const user = await userService.getById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const user = await userService.create({ ...req.body, companyId: req.body.companyId || req.user?.companyId });
      res.status(201).json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const user = await userService.update(req.params.id, req.body);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await userService.delete(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
