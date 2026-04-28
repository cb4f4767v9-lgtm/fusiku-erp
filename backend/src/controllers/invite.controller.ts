import type { Request, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { inviteService } from '../services/invite.service';
import { emailService } from '../services/email.service';
import { authService } from '../services/auth.service';

function appUrl(): string {
  return String(process.env.APP_URL || 'http://localhost:5173').trim();
}

function internalRegisterToken(): string | undefined {
  const t = String(process.env.INTERNAL_REGISTER_TOKEN || '').trim();
  return t || undefined;
}

export const inviteController = {
  /**
   * Creates an email invite token (JWT) for a user to join an existing company.
   * No DB required; token is self-contained and expires.
   */
  async create(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });

    // Minimal access control (extend later via RBAC permission codes).
    if (!['SUPER_ADMIN', 'BRANCH_ADMIN'].includes(String(req.user?.branchRole || ''))) {
      return res.status(403).json({ error: 'Insufficient permissions to invite users' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const roleId = String(req.body?.roleId || '').trim();
    const branchId = req.body?.branchId ? String(req.body.branchId).trim() : undefined;
    if (!email || !roleId) return res.status(400).json({ error: 'email and roleId are required' });

    const token = inviteService.signInvite({ email, companyId, roleId, ...(branchId ? { branchId } : {}) });
    const link = `${appUrl().replace(/\/$/, '')}/invite?token=${encodeURIComponent(token)}`;

    await emailService.send({
      to: email,
      subject: '[FUSIKU] You are invited',
      text: `You have been invited to join a company on Fusiku. Accept invite: ${link}`,
      html: `<p>You have been invited to join a company on Fusiku.</p><p><a href="${link}">Accept invite</a></p>`,
    });

    res.status(201).json({ token, link });
  },

  /**
   * Public endpoint: accept invite and create user in the invited company.
   * Uses INTERNAL_REGISTER_TOKEN bypass so public register can remain disabled.
   */
  async accept(req: Request, res: Response) {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    if (!token || !password || !name) {
      return res.status(400).json({ error: 'token, name, and password are required' });
    }

    const claims = inviteService.verifyInvite(token);

    const created = await authService.register(
      {
        email: claims.email,
        password,
        name,
        roleId: claims.roleId,
        companyId: claims.companyId,
        ...(claims.branchId ? { branchId: claims.branchId } : {}),
      },
      { internalRegisterToken: internalRegisterToken() }
    );

    res.status(201).json({ success: true, user: created });
  },
};

