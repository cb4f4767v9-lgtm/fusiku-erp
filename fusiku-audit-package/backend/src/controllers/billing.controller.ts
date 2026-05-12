import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { stripeBillingService } from '../services/stripeBilling.service';
import { prismaPlatform as prisma } from '../utils/prismaPlatform';

export const billingController = {
  async checkout(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });
    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'planId required' });
    const session = await stripeBillingService.createCheckoutSession({ companyId, planId });
    res.json(session);
  },

  async portal(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });
    const session = await stripeBillingService.createBillingPortalSession(companyId);
    res.json(session);
  },

  /**
   * Lightweight plan selection (no Stripe) for trial onboarding.
   * Updates the tenant `Subscription` row to the chosen plan.
   *
   * Current behavior (no payment integration yet):
   * - If tenant is still in free trial, UI can skip calling this endpoint and go to dashboard.
   * - If UI chooses a paid plan, we simulate success by setting status=active and advancing endDate.
   */
  async choosePlan(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });

    const { planKey, billingCycle } = req.body || {};
    const key = String(planKey || '').trim().toUpperCase();
    if (!key) return res.status(400).json({ error: 'planKey required (BASIC | PRO | ENTERPRISE)' });

    // Map UI plans to seeded catalog plan names.
    const planNameByKey: Record<string, string> = {
      BASIC: 'Starter',
      PRO: 'Business',
      ENTERPRISE: 'Enterprise',
    };
    const planName = planNameByKey[key];
    if (!planName) return res.status(400).json({ error: 'Invalid planKey' });

    const plan = await prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) return res.status(404).json({ error: `Plan not found: ${planName}` });

    const now = new Date();
    const cycle = String(billingCycle || 'monthly').trim().toLowerCase();
    const periodDays = cycle === 'weekly' ? 7 : cycle === 'yearly' ? 365 : 30;
    const endDate = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const sub = await prisma.subscription.upsert({
      where: { companyId },
      update: {
        planId: plan.id,
        status: 'active',
        startDate: now,
        endDate,
        trialEndsAt: null,
      },
      create: {
        companyId,
        planId: plan.id,
        status: 'active',
        startDate: now,
        endDate,
        trialEndsAt: null,
      },
      include: { plan: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        companyId,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        plan: { id: sub.planId, name: sub.plan?.name ?? planName },
      },
    });
  },
};

