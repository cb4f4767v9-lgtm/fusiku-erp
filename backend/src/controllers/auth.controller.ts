import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { authService } from '../services/auth.service';
import { clientIpFromRequest, loginLocationLabel } from '../utils/clientRequestMeta';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../utils/authCookies';

/**
 * If the auth result includes a refresh token, write it to the HttpOnly cookie.
 * Body field is left in place for backward compatibility with non-browser clients
 * and for in-flight upgrades; new browser sessions read it from the cookie.
 */
function attachRefreshCookie(res: Response, payload: unknown): void {
  if (!payload || typeof payload !== 'object') return;
  const rt = (payload as { refreshToken?: unknown }).refreshToken;
  if (typeof rt === 'string' && rt.trim()) {
    setRefreshTokenCookie(res, rt.trim());
  }
}

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password, companyId, language, currency, deviceId, browserLabel, stepUpChannel } =
        req.body;
      const ip = clientIpFromRequest(req);
      const location = loginLocationLabel(req, ip);
      const uaBits = [typeof browserLabel === 'string' ? browserLabel.trim() : '', req.get('user-agent') || '']
        .filter(Boolean)
        .join(' · ');
      const userAgent = uaBits || req.get('user-agent') || '';
      const deviceCtx =
        typeof deviceId === 'string' && deviceId.trim().length > 0
          ? { deviceId: deviceId.trim(), ip, location, userAgent }
          : undefined;
      const result = await authService.login(
        email,
        password,
        companyId,
        { language, currency },
        deviceCtx,
        typeof stepUpChannel === 'string' ? stepUpChannel : undefined
      );
      attachRefreshCookie(res, result);
      res.json(result);
    } catch (e: any) {
      const code = e?.statusCode === 403 ? 403 : e?.statusCode === 400 ? 400 : 401;
      res.status(code).json({ success: false, message: e.message, code: 'AUTH_LOGIN_FAILED' });
    }
  },

  async verifyLoginDevice(req: Request, res: Response) {
    try {
      const { challengeId, code } = req.body;
      const result = await authService.verifyLoginDevice(challengeId, code);
      attachRefreshCookie(res, result);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message, code: 'AUTH_DEVICE_VERIFY_FAILED' });
    }
  },

  async resendLoginDeviceOtp(req: Request, res: Response) {
    try {
      const { challengeId, channel } = req.body;
      const result = await authService.resendLoginDeviceOtp(challengeId, channel);
      res.json(result);
    } catch (e: any) {
      const status = e?.statusCode === 429 ? 429 : 400;
      res.status(status).json({ success: false, message: e.message, code: 'AUTH_DEVICE_OTP_RESEND_FAILED' });
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
      // Preferred source: HttpOnly cookie (`fusiku_rt`). Body / Authorization header
      // remain as fallbacks for non-browser clients and migration scenarios.
      const authHeader = req.headers.authorization;
      const token =
        readRefreshTokenCookie(req) ||
        (typeof req.body?.refreshToken === 'string' && req.body.refreshToken.trim()) ||
        (typeof req.body?.token === 'string' && req.body.token.trim()) ||
        (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '');
      if (!token) {
        clearRefreshTokenCookie(res);
        return res
          .status(401)
          .json({ success: false, message: 'Token required', code: 'REFRESH_TOKEN_REQUIRED' });
      }
      const result = await authService.refresh(token);
      attachRefreshCookie(res, result);
      res.json(result);
    } catch (e: any) {
      // Failed refresh → cookie is unusable, drop it so the browser stops sending it.
      clearRefreshTokenCookie(res);
      res.status(401).json({ success: false, message: e.message, code: 'AUTH_REFRESH_FAILED' });
    }
  },

  async logout(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        clearRefreshTokenCookie(res);
        return res.status(401).json({ success: false, message: 'Unauthorized', code: 'AUTH_REQUIRED' });
      }
      const out = await authService.logout(userId);
      clearRefreshTokenCookie(res);
      res.json(out);
    } catch (e: any) {
      // Best-effort cookie clear even on failure so the browser doesn't keep retrying.
      clearRefreshTokenCookie(res);
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
