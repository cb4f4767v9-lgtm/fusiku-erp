import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { analyticsService } from '../services/analytics.service';

export const analyticsController = {
  async dailyProfit(req: AuthRequest, res: Response) {
    const days = req.query.days;
    const branchId = (req.query.branchId as string | undefined) ?? null;
    const out = await analyticsService.dailyProfit({ days: days as any, branchId });
    res.json(out);
  },

  async branchPerformance(req: AuthRequest, res: Response) {
    const months = req.query.months;
    const out = await analyticsService.branchPerformance({ months: months as any });
    res.json(out);
  },

  async topSelling(req: AuthRequest, res: Response) {
    const days = req.query.days;
    const limit = req.query.limit;
    const branchId = (req.query.branchId as string | undefined) ?? null;
    const out = await analyticsService.topSelling({ days: days as any, limit: limit as any, branchId });
    res.json(out);
  },

  async inventoryAging(req: AuthRequest, res: Response) {
    const minAgeDays = req.query.minAgeDays;
    const limit = req.query.limit;
    const status = (req.query.status as string | undefined) ?? undefined;
    const branchId = (req.query.branchId as string | undefined) ?? null;
    const out = await analyticsService.inventoryAging({
      minAgeDays: minAgeDays as any,
      status,
      branchId,
      limit: limit as any,
    });
    res.json(out);
  },
};

