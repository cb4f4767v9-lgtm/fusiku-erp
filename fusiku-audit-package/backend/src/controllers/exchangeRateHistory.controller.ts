import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { exchangeRateHistoryService } from '../services/exchangeRateHistory.service';

export const exchangeRateHistoryController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const fromCurrency = req.query.fromCurrency != null ? String(req.query.fromCurrency) : undefined;
      const toCurrency = req.query.toCurrency != null ? String(req.query.toCurrency) : undefined;
      const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
      const rows = await exchangeRateHistoryService.list(companyId, { fromCurrency, toCurrency, limit });
      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
};

