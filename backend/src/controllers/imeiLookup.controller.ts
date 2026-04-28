import { Response } from 'express';
import { imeiLookupService } from '../services/imeiLookup.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const imeiLookupController = {
  async lookup(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const imei = req.params.imei;
      if (!imei || imei.length < 8) {
        return res.status(400).json({ error: 'Valid IMEI required (min 8 digits)' });
      }
      const result = await imeiLookupService.lookup(imei, companyId);
      res.json(result || { brand: '', model: '', storage: '', color: '', source: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
