import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { exchangeRateService } from '../services/exchangeRate.service';

export const exchangeRateController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const rates = await exchangeRateService.getAll();
      res.json(rates);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getCurrent(req: AuthRequest, res: Response) {
    try {
      const rate = await exchangeRateService.getCurrent(req.params.currency);
      res.json(rate);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const rate = await exchangeRateService.create(req.body);
      res.status(201).json(rate);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
