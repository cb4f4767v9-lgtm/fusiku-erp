import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import { getTenantContext } from '../utils/tenantContext';

export const setupProfileService = {
  async upsert(input: {
    businessType: string;
    platform: string;
    sourcingCountries: string[];
    sourcingOther: string | null;
    requirements: string;
  }) {
    const ctx = getTenantContext();
    if (!ctx?.companyId) throw new Error('Unauthorized');

    // Prisma client may lag behind schema in some dev setups; keep tolerant typing.
    const model = (prisma as any).setupProfile;
    if (!model) throw new Error('SetupProfile model is not available. Run Prisma generate/migrations.');

    const data = {
      companyId: ctx.companyId,
      businessType: String(input.businessType || '').trim(),
      platform: String(input.platform || '').trim(),
      sourcingCountries: input.sourcingCountries ?? [],
      sourcingOther: input.sourcingOther ? String(input.sourcingOther).trim() : null,
      requirements: String(input.requirements || '').trim(),
    };

    if (!data.businessType || !data.platform || !data.requirements) {
      throw new Error('Missing required setup fields');
    }
    if (!Array.isArray(data.sourcingCountries) || data.sourcingCountries.length === 0) {
      throw new Error('sourcingCountries is required');
    }

    return model.upsert({
      where: { companyId: ctx.companyId },
      update: data,
      create: data,
    });
  },
};

