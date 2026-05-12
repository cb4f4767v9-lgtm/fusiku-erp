import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supplierFxRateService } from '../services/supplierFxRate.service';

export const supplierFxRateController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const supplierId = String(req.params.id || '').trim();
      const rows = await supplierFxRateService.listForSupplier(companyId, supplierId);
      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async upsert(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const supplierId = String(req.params.id || '').trim();
      const currencyCode = String(req.params.code || '').trim();
      const rate = (req.body && typeof req.body === 'object' ? (req.body as any).rate : undefined) as unknown;
      const row = await supplierFxRateService.upsert(companyId, supplierId, currencyCode, Number(rate));
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const supplierId = String(req.params.id || '').trim();
      const currencyCode = String(req.params.code || '').trim();
      const out = await supplierFxRateService.remove(companyId, supplierId, currencyCode);
      res.json(out);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
};

