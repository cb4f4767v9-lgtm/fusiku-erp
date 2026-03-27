import { Request, Response } from 'express';
import { imeiLookupService } from '../services/imeiLookup.service';

export const imeiLookupController = {
  async lookup(req: Request, res: Response) {
    try {
      const imei = req.params.imei;
      if (!imei || imei.length < 8) {
        return res.status(400).json({ error: 'Valid IMEI required (min 8 digits)' });
      }
      const result = await imeiLookupService.lookup(imei);
      res.json(result || { brand: '', model: '', storage: '', color: '', source: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
