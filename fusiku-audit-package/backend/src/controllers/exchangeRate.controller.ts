import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { exchangeRateService } from '../services/exchangeRate.service';

export const exchangeRateController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const rates = await exchangeRateService.getAll(companyId);
      res.json(rates);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getCurrent(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const rate = await exchangeRateService.getCurrent(companyId, req.params.currency);
      res.json(rate);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const rate = await exchangeRateService.create(req.body);
      res.status(201).json(rate);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
