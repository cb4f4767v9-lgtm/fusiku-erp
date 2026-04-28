import { prisma } from '../utils/prisma';
import { deviceIdentificationService } from '../ai/deviceIdentification.service';

// In-memory cache for TAC lookups (Redis-ready structure)
const tacCache = new Map<string, { brand: string; model: string; storage?: string; color?: string }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cacheTimestamps = new Map<string, number>();

export interface ImeiLookupResult {
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  source: 'local' | 'cache' | 'external' | 'inventory';
}

export const imeiLookupService = {
  extractTac(imei: string): string {
    const cleaned = imei.replace(/\D/g, '');
    return cleaned.substring(0, 8);
  },

  getFromCache(tac: string): ImeiLookupResult | null {
    const cached = tacCache.get(tac);
    const ts = cacheTimestamps.get(tac);
    if (cached && ts && Date.now() - ts < CACHE_TTL_MS) {
      return { ...cached, source: 'cache' };
    }
    if (cached) {
      tacCache.delete(tac);
      cacheTimestamps.delete(tac);
    }
    return null;
  },

  setCache(tac: string, result: Omit<ImeiLookupResult, 'source'>) {
    tacCache.set(tac, result);
    cacheTimestamps.set(tac, Date.now());
  },

  async lookupFromLocal(tac: string, companyId: string): Promise<ImeiLookupResult | null> {
    const inventory = await prisma.inventory.findFirst({
      where: { companyId, imei: { startsWith: tac } },
      select: { brand: true, model: true, storage: true, color: true }
    });
    if (inventory) {
      return {
        brand: inventory.brand,
        model: inventory.model,
        storage: inventory.storage,
        color: inventory.color,
        source: 'local'
      };
    }
    const variant = await prisma.phoneVariant.findFirst({
      include: { model: { include: { brand: true } } }
    });
    if (variant) {
      return {
        brand: variant.model.brand.name,
        model: variant.model.name,
        storage: variant.storage,
        color: variant.color,
        source: 'local'
      };
    }
    return null;
  },

  async lookupFromExternal(tac: string): Promise<ImeiLookupResult | null> {
    try {
      const res = await fetch(`https://api.imei.info/device/${tac}?token=demo`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.model) {
          return {
            brand: data.brand || data.manufacturer || 'Unknown',
            model: data.model,
            storage: data.storage,
            color: data.color,
            source: 'external'
          };
        }
      }
    } catch {
      // External API failed - skip
    }
    return null;
  },

  async lookup(imei: string, companyId: string): Promise<ImeiLookupResult | null> {
    const aiResult = await deviceIdentificationService.identify(imei, { companyId });
    if (aiResult) {
      return {
        brand: aiResult.brand,
        model: aiResult.model,
        storage: aiResult.storage,
        color: aiResult.color,
        source: aiResult.source
      };
    }
    const tac = this.extractTac(imei);
    if (tac.length < 8) return null;

    const cached = this.getFromCache(tac);
    if (cached) return cached;

    let result = await this.lookupFromLocal(tac, companyId);
    if (!result) {
      result = await this.lookupFromExternal(tac);
    }
    if (result) {
      this.setCache(tac, result);
    }
    return result;
  }
};
