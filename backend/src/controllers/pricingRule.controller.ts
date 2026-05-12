import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { pricingRuleService } from '../services/pricingRule.service';

export const pricingRuleController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const vq = (req as any).validatedQuery as
        | { active?: boolean; take?: number; skip?: number }
        | undefined;
      const out = await pricingRuleService.list({
        active: vq?.active,
        take: vq?.take,
        skip: vq?.skip,
      });
      return res.json(out);
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const id = (req as any).validatedParams?.id ?? req.params.id;
      const rule = await pricingRuleService.getById(id);
      if (!rule) return res.status(404).json({ success: false, message: 'Pricing rule not found' });
      return res.json({ success: true, data: rule });
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const out = await pricingRuleService.create(req.body);
      return res.status(201).json({ success: true, data: out });
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const id = (req as any).validatedParams?.id ?? req.params.id;
      const out = await pricingRuleService.update(id, req.body);
      return res.json({ success: true, data: out });
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const id = (req as any).validatedParams?.id ?? req.params.id;
      const out = await pricingRuleService.remove(id);
      return res.json(out);
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  /** GET /pricing-rules/preview?costPrice=...  */
  async preview(req: AuthRequest, res: Response) {
    try {
      const cost = Number(req.query.costPrice ?? 0);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(400).json({ success: false, message: 'costPrice must be a non-negative number' });
      }
      const out = await pricingRuleService.preview(cost);
      return res.json({ success: true, data: out });
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },
};
