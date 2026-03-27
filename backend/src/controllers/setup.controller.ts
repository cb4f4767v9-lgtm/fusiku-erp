import { Request, Response } from 'express';
import { setupService } from '../services/setup.service';

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
  }
};
