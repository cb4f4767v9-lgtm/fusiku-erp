import { emitCurrencyUpdatedBulk } from '../platform/finance/financeEventEmitters';
import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';
import { saasPlanService } from './saasPlan.service';

export const companyService = {
  async getAll() {
    return prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  },

  /** Only returns the tenant's own company row. */
  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    if (id !== companyId) return null;
    return prisma.company.findFirst({
      where: { id: companyId },
      include: { companySettings: true }
    });
  },

  async getSettings(companyId: string) {
    const tenantId = requireTenantCompanyId();
    if (companyId !== tenantId) throw new Error('Forbidden');
    const existing = await prisma.companySettings.findFirst({
      where: { companyId: tenantId },
    });
    if (existing) return existing;

    // Ensure the tenant always has a settings row (schema defaults cover required fields).
    return prisma.companySettings.create({
      data: { companyId: tenantId } as any,
    });
  },

  async upsertSettings(
    companyId: string,
    data: {
      baseCurrency?: string;
      currency?: string;
      timezone?: string;
      taxRate?: number;
      invoicePrefix?: string;
      logo?: string;
      /** Forex desk half-spread in basis points (0 = buy/sell equal mid). */
      spreadBps?: number;
      /** Optional book equity in USD (company-owned capital for investor reports). */
      companyEquityUsd?: number | null;
      /** Inventory pricing method for NEW sales only. */
      pricingMethod?: 'FIFO' | 'LIFO' | 'CURRENT';
      /** Milestone flag only; does not change historical sales. */
      pricingLocked?: boolean;
      pricingLockedAt?: Date | null;
      /** Enterprise-only when plan feature `removeBranding` is enabled. */
      hidePoweredByBranding?: boolean;
    }
  ) {
    const tenantId = requireTenantCompanyId();
    if (companyId !== tenantId) throw new Error('Forbidden');
    const patch: typeof data = { ...data };
    delete (patch as Record<string, unknown>).companyId;
    // Ensure base currency is normalized and kept in sync with legacy `currency`.
    if (data.baseCurrency !== undefined || data.currency !== undefined) {
      const raw = (data.baseCurrency ?? data.currency) as unknown;
      const c = String(raw || 'USD').trim().toUpperCase() || 'USD';
      patch.baseCurrency = c as any;
      patch.currency = c as any; // legacy alias
    }
    if (data.spreadBps !== undefined) {
      const sb = Math.floor(Number(data.spreadBps));
      patch.spreadBps = Number.isFinite(sb) ? Math.max(0, Math.min(sb, 50_000)) : 0;
    }
    if (data.companyEquityUsd !== undefined) {
      const v = Number(data.companyEquityUsd);
      patch.companyEquityUsd = data.companyEquityUsd === null || !Number.isFinite(v) ? null : v;
    }
    if (data.pricingMethod !== undefined) {
      const m = String(data.pricingMethod || '').toUpperCase();
      patch.pricingMethod = m === 'LIFO' || m === 'CURRENT' ? (m as any) : ('FIFO' as any);
    }
    if (data.pricingLocked !== undefined) {
      patch.pricingLocked = Boolean(data.pricingLocked) as any;
      // If the UI sets locked=true without timestamp, mark it now.
      if (patch.pricingLocked && data.pricingLockedAt === undefined) {
        patch.pricingLockedAt = new Date() as any;
      }
      // Allow explicitly clearing timestamp.
      if (data.pricingLockedAt === null) patch.pricingLockedAt = null as any;
      if (data.pricingLockedAt instanceof Date) patch.pricingLockedAt = data.pricingLockedAt as any;
    }
    if (data.hidePoweredByBranding !== undefined) {
      const allowed = await saasPlanService.canRemovePoweredByBranding(tenantId);
      if (data.hidePoweredByBranding && !allowed) {
        throw new Error('Hiding “Powered by” branding is not included in your current plan.');
      }
      patch.hidePoweredByBranding = Boolean(data.hidePoweredByBranding) as any;
    }
    const row = await prisma.companySettings.upsert({
      where: { companyId: tenantId },
      update: patch as any,
      create: { companyId: tenantId, ...patch } as any
    });
    if (data.spreadBps !== undefined) {
      emitCurrencyUpdatedBulk(tenantId);
    }
    return row;
  },

  async getProfile() {
    const companyId = requireTenantCompanyId();
    const row = await prisma.company.findFirst({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        logo: true,
        email: true,
        phone: true,
        address: true,
        businessType: true,
      },
    });
    if (!row) return null;
    const saas = await saasPlanService.getProfileSaasOverlay(companyId);
    return { ...row, saas };
  },

  async updateProfile(data: {
    name?: string;
    logo?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }) {
    const companyId = requireTenantCompanyId();
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = String(data.name).trim() || 'Company';
    if (data.logo !== undefined) update.logo = data.logo;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.address !== undefined) update.address = data.address;
    return prisma.company.update({
      where: { id: companyId },
      data: update as any,
      select: { id: true, name: true, logo: true, email: true, phone: true, address: true }
    });
  }
};
