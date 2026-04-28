import { Request, Response } from 'express';
import { setupProfileService } from '../services/setupProfile.service';

export const setupProfileController = {
  async upsert(req: Request, res: Response) {
    try {
      const { businessType, platform, sourcingCountries, sourcingOther, requirements } = req.body || {};
      if (!businessType || !platform || !requirements) {
        return res.status(400).json({ error: 'businessType, platform, and requirements are required' });
      }
      if (!Array.isArray(sourcingCountries) || sourcingCountries.length === 0) {
        return res.status(400).json({ error: 'sourcingCountries must be a non-empty array' });
      }
      const out = await setupProfileService.upsert({
        businessType: String(businessType),
        platform: String(platform),
        sourcingCountries,
        sourcingOther: sourcingOther != null ? String(sourcingOther) : null,
        requirements: String(requirements),
      });
      return res.status(201).json({ success: true, data: out });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Unable to save setup profile' });
    }
  },
};

