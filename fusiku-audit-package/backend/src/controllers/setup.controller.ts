import { Request, Response } from 'express';
import { setupService } from '../services/setup.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const setupController = {
  async getStatus(req: Request, res: Response) {
    try {
      const status = await setupService.getSetupStatus();
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async complete(req: Request, res: Response) {
    try {
      const { companyName, adminEmail, adminPassword, branchName, currency } = req.body;
      if (!companyName || !adminEmail || !adminPassword || !branchName) {
        return res.status(400).json({ error: 'companyName, adminEmail, adminPassword, and branchName are required' });
      }
      if (adminPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      await setupService.completeSetup({
        companyName,
        adminEmail,
        adminPassword,
        branchName: branchName || 'Main Branch',
        currency: currency || 'USD'
      });
      res.status(201).json({ success: true, message: 'Setup completed. You can now log in.' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  /**
   * SaaS onboarding: create tenant for an authenticated (typically system admin / unassigned) user.
   * Does NOT replace first-time `/setup/complete`.
   */
  async initial(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { companyName, branchName, currency } = req.body || {};
      if (!companyName || !branchName || !currency) {
        return res.status(400).json({ error: 'companyName, branchName, and currency are required' });
      }

      const out = await setupService.initialSetupForUser(userId, {
        companyName: String(companyName),
        branchName: String(branchName),
        currency: String(currency),
      });

      return res.status(201).json({ success: true, company: out.company, branch: out.branch });
    } catch (e: any) {
      const status = e?.statusCode === 403 ? 403 : 400;
      return res.status(status).json({ error: e.message || 'Initial setup failed' });
    }
  }
};
