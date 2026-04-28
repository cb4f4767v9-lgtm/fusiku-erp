import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { authService } from '../services/auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password, companyId, language, currency } = req.body;
      const result = await authService.login(email, password, companyId, { language, currency });
      res.json(result);
    } catch (e: any) {
      const code = e?.statusCode === 403 ? 403 : 401;
      res.status(code).json({ success: false, message: e.message, code: 'AUTH_LOGIN_FAILED' });
    }
  },

  async register(req: Request, res: Response) {
    try {
      const internalRegisterToken = req.get('x-internal-register-token') || undefined;
      const result = await authService.register(req.body, { internalRegisterToken });
      res.status(201).json(result);
    } catch (e: any) {
      const code = e?.statusCode === 403 ? 403 : 400;
      res.status(code).json({ success: false, message: e.message, code: 'AUTH_REGISTER_FAILED' });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token =
        (typeof req.body?.refreshToken === 'string' && req.body.refreshToken.trim()) ||
        (typeof req.body?.token === 'string' && req.body.token.trim()) ||
        (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '');
      if (!token) return res.status(401).json({ success: false, message: 'Token required', code: 'REFRESH_TOKEN_REQUIRED' });
      const result = await authService.refresh(token);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ success: false, message: e.message, code: 'AUTH_REFRESH_FAILED' });
    }
  },

  async logout(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized', code: 'AUTH_REQUIRED' });
      const out = await authService.logout(userId);
      res.json(out);
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message, code: 'AUTH_LOGOUT_FAILED' });
    }
  },

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email, companyId } = req.body;
      const baseUrl = req.body.baseUrl || req.headers.origin;
      await authService.forgotPassword(email, companyId, baseUrl);
      res.json({ message: 'If an account exists, a reset link was sent to your email.' });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message, code: 'AUTH_FORGOT_PASSWORD_FAILED' });
    }
  },

  async me(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized', code: 'AUTH_REQUIRED' });
      const user = await authService.me(userId);
      res.json(user);
    } catch (e: any) {
      res.status(401).json({ success: false, message: e.message, code: 'AUTH_ME_FAILED' });
    }
  },

  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized', code: 'AUTH_REQUIRED' });
      const user = await authService.updatePreferences(userId, req.body || {});
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message, code: 'AUTH_PREFERENCES_FAILED' });
    }
  },

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized', code: 'AUTH_REQUIRED' });
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(userId, currentPassword, newPassword);
      res.json({ message: 'Password updated successfully' });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message, code: 'AUTH_CHANGE_PASSWORD_FAILED' });
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      await authService.resetPassword(token, password);
      res.json({ message: 'Password updated. You can now sign in.' });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message, code: 'AUTH_RESET_PASSWORD_FAILED' });
    }
  }
};
