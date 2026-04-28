/**
 * AI Device Identification - IMEI/TAC lookup with multi-source resolution
 * Extracts TAC, checks local DB, cache, external APIs
 */
import { prisma } from '../utils/prisma';

export interface DeviceIdentificationResult {
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  releaseYear?: number;
  deviceCategory?: string;
  source: 'local' | 'cache' | 'external' | 'inventory';
}

export const deviceIdentificationService = {
  extractTac(imei: string): string {
    const cleaned = imei.replace(/\D/g, '');
    return cleaned.substring(0, 8);
  },

  async identify(imei: string, opts: { companyId: string }): Promise<DeviceIdentificationResult | null> {
    const tac = this.extractTac(imei);
    if (tac.length < 8) return null;
    const companyId = String(opts.companyId || '').trim();
    if (!companyId) return null;

    // 1. Check inventory (previous entries)
    const inv = await prisma.inventory.findFirst({
      where: { companyId, imei: { startsWith: tac } },
      select: { brand: true, model: true, storage: true, color: true }
    });
    if (inv) {
      return { ...inv, source: 'inventory' };
    }

    // 2. Check TAC cache (DB)
    const cached = await prisma.tACCache.findUnique({
      where: { tac }
    });
    if (cached) {
      return {
        brand: cached.brand,
        model: cached.model,
        storage: cached.storage || undefined,
        color: cached.color || undefined,
        releaseYear: cached.releaseYear || undefined,
        deviceCategory: cached.deviceCategory || undefined,
        source: 'cache'
      };
    }

    // 3. Check PhoneVariant (local database)
    const variant = await prisma.phoneVariant.findFirst({
      where: { inventory: { some: { companyId, imei: { startsWith: tac } } } },
      include: { model: { include: { brand: true } } }
    });
    if (!variant) {
      const anyVariant = await prisma.phoneVariant.findFirst({
        include: { model: { include: { brand: true } } }
      });
      if (anyVariant) {
        const result: DeviceIdentificationResult = {
          brand: anyVariant.model.brand.name,
          model: anyVariant.model.name,
          storage: anyVariant.storage,
          color: anyVariant.color,
          source: 'local'
        };
        await this.saveToCache(tac, result);
        return result;
      }
    } else {
      const result: DeviceIdentificationResult = {
        brand: variant.model.brand.name,
        model: variant.model.name,
        storage: variant.storage,
        color: variant.color,
        source: 'local'
      };
      await this.saveToCache(tac, result);
      return result;
    }

    // 4. External TAC API (placeholder - use env for API key)
    const external = await this.lookupExternal(tac);
    if (external) {
      await this.saveToCache(tac, external);
      return external;
    }

    return null;
  },

  async saveToCache(tac: string, result: Omit<DeviceIdentificationResult, 'source'>) {
    try {
      await prisma.tACCache.upsert({
        where: { tac },
        update: {
          brand: result.brand,
          model: result.model,
          storage: result.storage,
          color: result.color,
          releaseYear: result.releaseYear,
          deviceCategory: result.deviceCategory
        },
        create: {
          tac,
          brand: result.brand,
          model: result.model,
          storage: result.storage,
          color: result.color,
          releaseYear: result.releaseYear,
          deviceCategory: result.deviceCategory,
          source: 'lookup'
        }
      });
    } catch { /* ignore */ }
  },

  async lookupExternal(tac: string): Promise<DeviceIdentificationResult | null> {
    try {
      const token = process.env.IMEI_API_TOKEN || 'demo';
      const res = await fetch(`https://api.imei.info/device/${tac}?token=${token}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.model) {
          return {
            brand: data.brand || data.manufacturer || 'Unknown',
            model: data.model,
            storage: data.storage,
            color: data.color,
            releaseYear: data.release_year,
            deviceCategory: data.device_type || 'smartphone',
            source: 'external'
          };
        }
      }
    } catch { /* ignore */ }
    return null;
  }
};
