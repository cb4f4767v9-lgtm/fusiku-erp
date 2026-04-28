import { Request, Response } from 'express';
import { saasPlanService } from '../services/saasPlan.service';

export const planController = {
  /** Public catalog of sellable plans (no secrets). */
  async listPublic(_req: Request, res: Response) {
    try {
      const plans = await saasPlanService.listActivePlans();
      res.json(
        plans.map((p) => ({
          id: p.planId,
          name: p.planName,
          priceMonthly: p.priceMonthly,
          pricingModel: p.pricingModel,
          pricePerBranchMonthly: p.pricePerBranchMonthly,
          modulePrices: p.modulePrices,
          maxBranches: p.maxBranches,
          maxUsers: p.maxUsers,
          limitsUnlimited: p.limitsUnlimited,
          features: p.features,
        }))
      );
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
};
