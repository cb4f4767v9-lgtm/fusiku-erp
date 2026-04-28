import type { Prisma, Subscription, SubscriptionPlan } from '@prisma/client';
import { prisma } from '../utils/prisma';

export type PlanFeatureKey =
  | 'multiCurrency'
  | 'aiInsights'
  | 'forexTrading'
  | 'removeBranding'
  | string;

export type ResolvedSaasPlan = {
  planId: string;
  planName: string;
  pricingModel: string;
  priceMonthly: number;
  pricePerBranchMonthly: number | null;
  modulePrices: Record<string, number> | null;
  limitsUnlimited: boolean;
  maxBranches: number;
  maxUsers: number;
  features: Record<string, boolean>;
};

export type CompanySubscriptionView = {
  companyId: string;
  planId: string;
  status: string;
  trialEndsAt: Date | null;
  startedAt: Date;
  endsAt: Date;
  plan: ResolvedSaasPlan;
};

const DEFAULT_FEATURES: Record<string, boolean> = {
  multiCurrency: false,
  aiInsights: false,
  forexTrading: false,
  removeBranding: false,
};

export function normalizePlanFeatures(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_FEATURES };
  }
  const out = { ...DEFAULT_FEATURES };
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = Boolean(v);
  }
  return out;
}

function asModulePrices(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) o[k] = n;
  }
  return Object.keys(o).length ? o : null;
}

export function resolvePlanRow(plan: SubscriptionPlan): ResolvedSaasPlan {
  return {
    planId: plan.id,
    planName: plan.name,
    pricingModel: plan.pricingModel || 'flat',
    priceMonthly: plan.priceMonthly,
    pricePerBranchMonthly: plan.pricePerBranchMonthly ?? null,
    modulePrices: asModulePrices(plan.modulePrices),
    limitsUnlimited: plan.limitsUnlimited,
    maxBranches: plan.maxBranches,
    maxUsers: plan.maxUsers,
    features: normalizePlanFeatures(plan.features),
  };
}

/** Hard billing failure: no writes at all (except reads). */
export function subscriptionHardExpired(sub: Subscription, now = new Date()): boolean {
  if (sub.status === 'cancelled' || sub.status === 'expired') return true;
  if (sub.endDate < now) return true;
  return false;
}

/**
 * Trial window ended but paid period (endDate) may still be in the future.
 * Commercial ops (POS, purchases, inventory writes) are blocked until upgrade.
 */
export function trialCommercialLockActive(sub: Subscription, now = new Date()): boolean {
  if (subscriptionHardExpired(sub, now)) return false;
  return sub.status === 'trial' && !!sub.trialEndsAt && sub.trialEndsAt < now;
}

/** Full service (not hard-expired and not in post-trial commercial lock). */
export function subscriptionIsEntitled(sub: Subscription, plan: SubscriptionPlan, now = new Date()): boolean {
  if (subscriptionHardExpired(sub, now)) return false;
  if (trialCommercialLockActive(sub, now)) return false;
  return true;
}

/** Quoted monthly total for billing UI (does not persist invoices). */
export function quoteMonthlyTotal(
  plan: ResolvedSaasPlan,
  opts: { branchCount: number; enabledModuleKeys?: string[] }
): number {
  if (plan.pricingModel === 'unlimited' || plan.limitsUnlimited) {
    return plan.priceMonthly;
  }
  let total = plan.priceMonthly;
  if (plan.pricingModel === 'per_branch' && plan.pricePerBranchMonthly != null) {
    const extra = Math.max(0, opts.branchCount - 1);
    total += extra * plan.pricePerBranchMonthly;
  }
  if (plan.pricingModel === 'per_module' && plan.modulePrices && opts.enabledModuleKeys?.length) {
    for (const key of opts.enabledModuleKeys) {
      const add = plan.modulePrices[key];
      if (typeof add === 'number' && Number.isFinite(add)) total += add;
    }
  }
  return Math.round(total * 100) / 100;
}

export const saasPlanService = {
  async getCompanySubscription(companyId: string): Promise<CompanySubscriptionView | null> {
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub) return null;
    return {
      companyId: sub.companyId,
      planId: sub.planId,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      startedAt: sub.startDate,
      endsAt: sub.endDate,
      plan: resolvePlanRow(sub.plan),
    };
  },

  async assertSubscriptionActive(companyId: string): Promise<void> {
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub) throw new Error('No subscription found for this company');
    if (subscriptionHardExpired(sub, new Date())) {
      throw new Error('Subscription has expired. Renew or upgrade your plan to continue.');
    }
  },

  async companyHasFeature(companyId: string, feature: PlanFeatureKey): Promise<boolean> {
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub || subscriptionHardExpired(sub, new Date())) return false;
    return Boolean(resolvePlanRow(sub.plan).features[feature]);
  },

  async assertCanAddBranch(companyId: string): Promise<void> {
    await this.assertSubscriptionActive(companyId);
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub) throw new Error('No subscription found for this company');
    const plan = resolvePlanRow(sub.plan);
    if (plan.limitsUnlimited || plan.pricingModel === 'unlimited') return;
    const count = await prisma.branch.count({ where: { companyId, isActive: true } });
    if (count >= plan.maxBranches) {
      throw new Error(
        `Branch limit reached (${plan.maxBranches} on your ${plan.planName} plan). Upgrade to add more branches.`
      );
    }
  },

  async assertCanAddUser(companyId: string): Promise<void> {
    await this.assertSubscriptionActive(companyId);
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub) throw new Error('No subscription found for this company');
    const plan = resolvePlanRow(sub.plan);
    if (plan.limitsUnlimited || plan.pricingModel === 'unlimited') return;
    const count = await prisma.user.count({ where: { companyId, isActive: true } });
    if (count >= plan.maxUsers) {
      throw new Error(
        `User limit reached (${plan.maxUsers} on your ${plan.planName} plan). Upgrade to add more users.`
      );
    }
  },

  async canRemovePoweredByBranding(companyId: string): Promise<boolean> {
    return this.companyHasFeature(companyId, 'removeBranding');
  },

  /**
   * Footer "Powered by" visibility: locked on for plans without removeBranding;
   * Enterprise may hide via CompanySettings.hidePoweredByBranding.
   */
  async resolvePoweredByVisibility(companyId: string): Promise<{ showPoweredBy: boolean }> {
    const [settings, canRemove] = await Promise.all([
      prisma.companySettings.findUnique({
        where: { companyId },
        select: { hidePoweredByBranding: true },
      }),
      this.canRemovePoweredByBranding(companyId),
    ]);
    if (!canRemove) return { showPoweredBy: true };
    const hide = Boolean(settings?.hidePoweredByBranding);
    return { showPoweredBy: !hide };
  },

  async getProfileSaasOverlay(companyId: string): Promise<{
    subscription: Pick<CompanySubscriptionView, 'status' | 'trialEndsAt' | 'startedAt' | 'endsAt'> | null;
    planName: string | null;
    features: Record<string, boolean>;
    showPoweredBy: boolean;
    limits: { maxBranches: number; maxUsers: number; unlimited: boolean };
    /** Account is within paid window (legacy installs without a row: treated as OK). */
    entitled: boolean;
    hardExpired: boolean;
    trialCommercialLock: boolean;
    /** POS / purchases / inventory writes allowed. */
    commercialWritesAllowed: boolean;
  }> {
    const now = new Date();
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!sub) {
      return {
        subscription: null,
        planName: null,
        features: { ...DEFAULT_FEATURES },
        showPoweredBy: true,
        limits: { maxBranches: 0, maxUsers: 0, unlimited: false },
        entitled: true,
        hardExpired: false,
        trialCommercialLock: false,
        commercialWritesAllowed: true,
      };
    }
    const plan = resolvePlanRow(sub.plan);
    const hardExpired = subscriptionHardExpired(sub, now);
    const trialCommercialLock = trialCommercialLockActive(sub, now);
    const entitled = !hardExpired;
    const commercialWritesAllowed = !hardExpired && !trialCommercialLock;
    const { showPoweredBy } = await this.resolvePoweredByVisibility(companyId);
    return {
      subscription: {
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        startedAt: sub.startDate,
        endsAt: sub.endDate,
      },
      planName: plan.planName,
      features: plan.features,
      showPoweredBy,
      limits: {
        maxBranches: plan.maxBranches,
        maxUsers: plan.maxUsers,
        unlimited: plan.limitsUnlimited || plan.pricingModel === 'unlimited',
      },
      entitled,
      hardExpired,
      trialCommercialLock,
      commercialWritesAllowed,
    };
  },

  async listActivePlans(): Promise<ResolvedSaasPlan[]> {
    const rows = await prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { priceMonthly: 'asc' },
    });
    return rows.map(resolvePlanRow);
  },

  /** Pick default plan for new tenants: Starter if seeded, else Free. */
  async resolveDefaultSignupPlanId(tx: Prisma.TransactionClient): Promise<string> {
    const starter = await tx.subscriptionPlan.findFirst({
      where: { name: 'Starter', active: true },
      select: { id: true },
    });
    if (starter) return starter.id;
    const free = await tx.subscriptionPlan.findFirst({
      where: { name: 'Free' },
      select: { id: true },
    });
    if (!free) throw new Error('No subscription plan found. Run database seed first.');
    return free.id;
  },
};
