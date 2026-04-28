import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { saasSignupService } from '../services/saasSignup.service';
import { isPublicSignupEndpointEnabled } from '../utils/publicSignupGate';

function displayNameFromEmail(email: string): string {
  const local = String(email || '').split('@')[0] || 'Admin';
  const cleaned = local.replace(/[^a-zA-Z0-9._-]/g, ' ').trim();
  if (!cleaned) return 'Admin';
  return cleaned.slice(0, 80);
}

export const signupController = {
  async createTenant(req: Request, res: Response) {
    if (!isPublicSignupEndpointEnabled()) {
      return res.status(403).json({ error: 'Public signup is not enabled on this server' });
    }

    // Honeypot — real clients leave empty; bots often fill hidden fields.
    if (req.body && String((req.body as { website?: unknown }).website || '').trim() !== '') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    try {
      const body = req.body as {
        companyName?: unknown;
        email?: unknown;
        password?: unknown;
        businessType?: unknown;
      };
      const companyName = String(body.companyName ?? '').trim();
      const email = String(body.email ?? '').trim();
      const password = String(body.password ?? '');
      const businessType =
        body.businessType === undefined || body.businessType === null
          ? undefined
          : String(body.businessType);

      const provisioned = await saasSignupService.provisionTenantWithValidation({
        companyName,
        adminEmail: email,
        adminPassword: password,
        adminName: displayNameFromEmail(email.toLowerCase()),
        businessType,
      });

      const session = await authService.issueAuthSessionForUserId(provisioned.userId, provisioned.companyId, 'tenant_signup');

      res.status(201).json({
        companyId: provisioned.companyId,
        userId: provisioned.userId,
        token: session.token,
        refreshToken: session.refreshToken,
        user: session.user,
      });
    } catch (e: any) {
      const code = e?.statusCode === 404 ? 404 : 400;
      res.status(code).json({ error: e.message || 'Signup failed' });
    }
  },
};
