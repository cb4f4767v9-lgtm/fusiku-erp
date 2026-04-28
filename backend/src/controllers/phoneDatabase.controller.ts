import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';
import { getRequestBaseLanguage } from '../utils/requestLanguage';

export const phoneDatabaseController = {
  async getBrands(req: AuthRequest, res: Response) {
    try {
      const lang = getRequestBaseLanguage(req);
      const brands = await prisma.phoneBrand.findMany({
        include: { translations: true, _count: { select: { phoneModels: true } } },
        orderBy: { name: 'asc' }
      });
      const withDisplayName = brands.map((b) => ({
        ...b,
        displayName: b.translations.find((t) => t.language === lang)?.translatedName || b.name
      }));
      res.json(withDisplayName);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getModels(req: AuthRequest, res: Response) {
    try {
      const lang = getRequestBaseLanguage(req);
      const brandId = req.params.brandId;
      const models = await prisma.phoneModel.findMany({
        where: { brandId },
        include: { translations: true, _count: { select: { variants: true } } },
        orderBy: { name: 'asc' }
      });
      const withDisplayName = models.map((m) => ({
        ...m,
        displayName: m.translations.find((t) => t.language === lang)?.translatedName || m.name
      }));
      res.json(withDisplayName);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getVariants(req: AuthRequest, res: Response) {
    try {
      const lang = getRequestBaseLanguage(req);
      const modelId = req.params.modelId;
      const variants = await prisma.phoneVariant.findMany({
        where: { modelId },
        include: { model: { include: { translations: true, brand: { include: { translations: true } } } } },
        orderBy: [{ storage: 'asc' }, { color: 'asc' }]
      });
      const withDisplayName = variants.map((v) => {
        const model = v.model;
        const brand = model?.brand;
        const modelDisplayName = model?.translations?.find((t) => t.language === lang)?.translatedName || model?.name;
        const brandDisplayName = brand?.translations?.find((t) => t.language === lang)?.translatedName || brand?.name;
        return {
          ...v,
          model: model
            ? { ...model, displayName: modelDisplayName, brand: brand ? { ...brand, displayName: brandDisplayName } : brand }
            : model
        };
      });
      res.json(withDisplayName);
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
