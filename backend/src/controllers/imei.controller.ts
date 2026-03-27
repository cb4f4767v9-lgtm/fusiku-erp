import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { imeiService } from '../services/imei.service';

import { imeiHistoryService } from '../services/imeiHistory.service';

export const imeiController = {
  async check(req: AuthRequest, res: Response) {
    try {
      const result = await imeiService.check(req.params.imei);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async history(req: AuthRequest, res: Response) {
    try {
      const history = await imeiHistoryService.getHistory(req.params.imei);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async record(req: AuthRequest, res: Response) {
    try {
      const { imei, action, notes, inventoryId } = req.body;
      const record = await imeiService.record(imei, action, notes, inventoryId);
      res.status(201).json(record);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
