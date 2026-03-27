import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';

export const phoneDatabaseController = {
  async getBrands(req: AuthRequest, res: Response) {
    try {
      const brands = await prisma.phoneBrand.findMany({
        include: { _count: { select: { phoneModels: true } } },
        orderBy: { name: 'asc' }
      });
      res.json(brands);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getModels(req: AuthRequest, res: Response) {
    try {
      const brandId = req.params.brandId;
      const models = await prisma.phoneModel.findMany({
        where: { brandId },
        include: { _count: { select: { variants: true } } },
        orderBy: { name: 'asc' }
      });
      res.json(models);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getVariants(req: AuthRequest, res: Response) {
    try {
      const modelId = req.params.modelId;
      const variants = await prisma.phoneVariant.findMany({
        where: { modelId },
        include: { model: { include: { brand: true } } },
        orderBy: [{ storage: 'asc' }, { color: 'asc' }]
      });
      res.json(variants);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async createBrand(req: AuthRequest, res: Response) {
    try {
      const brand = await prisma.phoneBrand.create({ data: req.body });
      res.status(201).json(brand);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async createModel(req: AuthRequest, res: Response) {
    try {
      const model = await prisma.phoneModel.create({ data: req.body });
      res.status(201).json(model);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async createVariant(req: AuthRequest, res: Response) {
    try {
      const variant = await prisma.phoneVariant.create({ data: req.body });
      res.status(201).json(variant);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
