import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';
import { getRequestBaseLanguage } from '../utils/requestLanguage';

const entities = {
  categories: prisma.masterCategory,
  brands: prisma.phoneBrand,
  phoneModels: prisma.phoneModel,
  storageSizes: prisma.storageSize,
  spareParts: prisma.masterSparePart,
  screenQualities: prisma.masterScreenQuality,
  toolBrands: prisma.masterToolBrand,
  deviceColors: prisma.deviceColor,
  deviceQualities: prisma.deviceQuality,
  deviceFaults: prisma.deviceFault
} as const;

type EntityKey = keyof typeof entities;

const config: Record<EntityKey, { uniqueField: string; createFields: string[]; updateFields: string[] }> = {
  categories: { uniqueField: 'name', createFields: ['name', 'nameZh', 'nameAr', 'nameUr'], updateFields: ['name', 'nameZh', 'nameAr', 'nameUr'] },
  brands: { uniqueField: 'name', createFields: ['name'], updateFields: ['name'] },
  phoneModels: { uniqueField: 'id', createFields: ['brandId', 'name', 'releaseYear'], updateFields: ['brandId', 'name', 'releaseYear'] },
  storageSizes: { uniqueField: 'sizeGb', createFields: ['sizeGb', 'label'], updateFields: ['sizeGb', 'label'] },
  spareParts: { uniqueField: 'name', createFields: ['name'], updateFields: ['name'] },
  screenQualities: { uniqueField: 'name', createFields: ['name'], updateFields: ['name'] },
  toolBrands: { uniqueField: 'name', createFields: ['name'], updateFields: ['name'] },
  deviceColors: { uniqueField: 'name', createFields: ['name'], updateFields: ['name'] },
  deviceQualities: { uniqueField: 'name', createFields: ['name'], updateFields: ['name'] },
  deviceFaults: { uniqueField: 'name', createFields: ['name'], updateFields: ['name'] }
};

function getRepo(entity: EntityKey) {
  return entities[entity] as any;
}

export const masterDataController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const { entity } = req.params as { entity: EntityKey };
      if (!entities[entity]) return res.status(400).json({ error: 'Invalid entity' });

      const repo = getRepo(entity);
      let data: any[];
      const lang = getRequestBaseLanguage(req);

      const resolveTranslatedName = (row: any): string => {
        // Prefer new translation tables.
        const t = row?.translations?.find?.((x: any) => x?.language === lang)?.translatedName;
        if (t) return t;
        // Back-compat for MasterCategory legacy columns until fully migrated.
        if (lang === 'zh' && row?.nameZh) return row.nameZh;
        if (lang === 'ar' && row?.nameAr) return row.nameAr;
        if (lang === 'ur' && row?.nameUr) return row.nameUr;
        return row?.name || '';
      };

      if (entity === 'phoneModels') {
        const brandId = req.query.brandId as string | undefined;
        data = await repo.findMany({
          where: brandId ? { brandId } : undefined,
          include: {
            translations: true,
            brand: { include: { translations: true } }
          },
          orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }]
        });
        data = data.map((r: any) => ({
          ...r,
          displayName: resolveTranslatedName(r),
          brand: r.brand
            ? { ...r.brand, displayName: resolveTranslatedName(r.brand) }
            : r.brand
        }));
      } else if (entity === 'storageSizes') {
        data = await repo.findMany({ orderBy: { sizeGb: 'asc' } });
      } else if (['deviceColors', 'deviceQualities', 'deviceFaults'].includes(entity)) {
        data = await repo.findMany({ orderBy: { name: 'asc' } });
      } else {
        const needsTranslations = entity === 'categories' || entity === 'brands';
        data = await repo.findMany({
          ...(needsTranslations ? { include: { translations: true } } : {}),
          orderBy: { name: 'asc' }
        });
        if (needsTranslations) {
          data = data.map((r: any) => ({ ...r, displayName: resolveTranslatedName(r) }));
        }
      }

      const q = (req.query.q as string)?.toLowerCase();
      if (q) {
        data = data.filter((r: any) => {
          const name = (r.name || '').toLowerCase();
          const displayName = (r.displayName || '').toLowerCase();
          const label = (r.label || '').toLowerCase();
          const brandName = (r.brand?.name || '').toLowerCase();
          const brandDisplayName = (r.brand?.displayName || '').toLowerCase();
          return (
            name.includes(q) ||
            displayName.includes(q) ||
            label.includes(q) ||
            brandName.includes(q) ||
            brandDisplayName.includes(q)
          );
        });
      }

      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { entity } = req.params as { entity: EntityKey };
      if (!entities[entity]) return res.status(400).json({ error: 'Invalid entity' });

      const cfg = config[entity];
      const repo = getRepo(entity);
      const body = req.body;

      const data: any = {};
      for (const f of cfg.createFields) {
        if (body[f] !== undefined && body[f] !== '') data[f] = body[f];
      }
      if (entity === 'phoneModels' && data.releaseYear !== undefined) {
        data.releaseYear = data.releaseYear ? parseInt(data.releaseYear, 10) : null;
      }
      if (entity === 'storageSizes' && data.sizeGb !== undefined) {
        data.sizeGb = parseInt(data.sizeGb, 10);
        if (!data.label) data.label = data.sizeGb >= 1024 ? `${data.sizeGb / 1024} TB` : `${data.sizeGb} GB`;
      }

      const created = await repo.create({ data });
      res.status(201).json(created);
    } catch (e: any) {
      if (e.code === 'P2002') {
        return res.status(409).json({ error: 'Item already exists.' });
      }
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { entity, id } = req.params as { entity: EntityKey; id: string };
      if (!entities[entity]) return res.status(400).json({ error: 'Invalid entity' });

      const cfg = config[entity];
      const repo = getRepo(entity);
      const body = req.body;

      const data: any = {};
      for (const f of cfg.updateFields) {
        if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
      }
      if (entity === 'phoneModels' && data.releaseYear !== undefined) {
        data.releaseYear = data.releaseYear ? parseInt(data.releaseYear, 10) : null;
      }
      if (entity === 'storageSizes' && data.sizeGb !== undefined) {
        data.sizeGb = parseInt(data.sizeGb, 10);
      }

      const updated = await repo.update({ where: { id }, data });
      res.json(updated);
    } catch (e: any) {
      if (e.code === 'P2002') {
        return res.status(409).json({ error: 'Item already exists.' });
      }
      res.status(400).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const { entity, id } = req.params as { entity: EntityKey; id: string };
      if (!entities[entity]) return res.status(400).json({ error: 'Invalid entity' });

      const repo = getRepo(entity);
      await repo.delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
