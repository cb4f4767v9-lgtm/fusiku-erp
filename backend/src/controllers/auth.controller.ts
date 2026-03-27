import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { authService } from '../services/auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json(result);
    } catch (e: any) {
      const code = e?.statusCode === 403 ? 403 : 401;
      res.status(code).json({ error: e.message });
    }
  },

  async register(req: Request, res: Response) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body?.refreshToken || req.body?.token;
      if (!token) return res.status(401).json({ error: 'Token required' });
      const result = await authService.refresh(token);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  },

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const baseUrl = req.body.baseUrl || req.headers.origin;
      await authService.forgotPassword(email, baseUrl);
      res.json({ message: 'If an account exists, a reset link was sent to your email.' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(userId, currentPassword, newPassword);
      res.json({ message: 'Password updated successfully' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      await authService.resetPassword(token, password);
      res.json({ message: 'Password updated. You can now sign in.' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
