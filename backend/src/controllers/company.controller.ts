import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { companyService } from '../services/company.service';

export const companyController = {
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || req.params.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });
      const settings = await companyService.getSettings(companyId);
      if (!settings) return res.status(404).json({ error: 'Settings not found' });
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || req.body.companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });
      const settings = await companyService.upsertSettings(companyId, req.body);
      res.json(settings);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
