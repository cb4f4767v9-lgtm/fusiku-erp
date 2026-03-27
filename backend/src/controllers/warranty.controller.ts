import { Request, Response } from 'express';
import { warrantyService } from '../services/warranty.service';

export const warrantyController = {
  async getByImei(req: Request, res: Response) {
    try {
      const result = await warrantyService.getByImei(req.params.imei);
      if (!result) return res.status(404).json({ error: 'No warranty found for this IMEI' });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
