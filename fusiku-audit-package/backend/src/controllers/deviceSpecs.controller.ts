import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';

export const deviceSpecsController = {
  async getByModel(req: AuthRequest, res: Response) {
    try {
      const model = decodeURIComponent(req.params.model);
      const spec = await prisma.deviceSpecification.findFirst({
        where: { model: { equals: model } },
        include: { features: true }
      });
      if (!spec) return res.status(404).json({ error: 'Specification not found' });
      res.json(spec);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
