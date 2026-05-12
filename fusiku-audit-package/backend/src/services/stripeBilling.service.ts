import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

function stripeEnabled(): boolean {
  return process.env.STRIPE_BILLING === '1';
}

function stripeClient(): any {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
  }
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' as any });
}

function appUrl(): string {
  return String(process.env.APP_URL || 'http://localhost:5173').trim();
}

function priceIdForPlan(planName: string): string {
  const envKey = `STRIPE_PRICE_${planName.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
  const priceId = String(process.env[envKey] || '').trim();
  if (!priceId) {
    throw new Error(`Stripe price not mapped for plan "${planName}" (missing ${envKey})`);
  }
  return priceId;
}

export const stripeBillingService = {
  enabled: stripeEnabled,

  async ensureCustomer(companyId: string): Promise<{ stripeCustomerId: string }> {
    const sub = await prisma.subscription.findUnique({ where: { companyId } });
    if (sub?.stripeCustomerId) return { stripeCustomerId: sub.stripeCustomerId };

    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, name: true, email: true },
    });
    if (!company) throw new Error('Company not found');

    const stripe = stripeClient();
    const customer = await stripe.customers.create({
      name: company.name,
      email: company.email || undefined,
      metadata: { companyId: company.id },
    });

    // Keep subscription row in sync (create if missing to avoid breaking legacy installs).
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'Free' },
      select: { id: true },
    });
    if (!plan) throw new Error('Default plan not found (seed SubscriptionPlan)');

    await prisma.subscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId: plan.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'active',
        stripeCustomerId: customer.id,
      },
      update: { stripeCustomerId: customer.id },
    });

    return { stripeCustomerId: customer.id };
  },

  async createCheckoutSession(opts: { companyId: string; planId: string }) {
    if (!stripeEnabled()) throw new Error('Stripe billing is disabled');

    const [plan, { stripeCustomerId }] = await Promise.all([
      prisma.subscriptionPlan.findUnique({ where: { id: opts.planId } }),
      this.ensureCustomer(opts.companyId),
    ]);
    if (!plan) throw new Error('Plan not found');

    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceIdForPlan(plan.name), quantity: 1 }],
      success_url: `${appUrl()}/settings/billing?success=1`,
      cancel_url: `${appUrl()}/settings/billing?canceled=1`,
      client_reference_id: opts.companyId,
      metadata: { companyId: opts.companyId, planId: plan.id, planName: plan.name },
    });
    return { id: session.id, url: session.url };
  },

  async createBillingPortalSession(companyId: string) {
    if (!stripeEnabled()) throw new Error('Stripe billing is disabled');
    const { stripeCustomerId } = await this.ensureCustomer(companyId);
    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl()}/settings/billing`,
    });
    return { url: session.url };
  },

  async handleWebhook(rawBody: Buffer, signature: string | string[] | undefined) {
    if (!stripeEnabled()) {
      return { ignored: true };
    }
    const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!secret) throw new Error('Stripe webhook not configured (missing STRIPE_WEBHOOK_SECRET)');

    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!sig) throw new Error('Missing Stripe-Signature header');

    const stripe = stripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, sig, secret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const companyId = (session.metadata?.companyId || session.client_reference_id || '').toString();
        const planId = (session.metadata?.planId || '').toString();
        const stripeSubscriptionId = (session.subscription || '').toString();
        if (!companyId || !planId || !stripeSubscriptionId) break;

        await prisma.subscription.upsert({
          where: { companyId },
          create: {
            companyId,
            planId,
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            status: 'active',
            stripeCustomerId: (session.customer || '').toString() || null,
            stripeSubscriptionId,
          },
          update: {
            planId,
            status: 'active',
            stripeCustomerId: (session.customer || '').toString() || undefined,
            stripeSubscriptionId,
          },
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const stripeSubscriptionId = sub.id;
        const status = sub.status;
        const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        // Best-effort mapping: find tenant subscription row by stripeSubscriptionId.
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: {
            status: status === 'canceled' ? 'cancelled' : status,
            currentPeriodEnd: currentPeriodEnd ?? undefined,
            endDate: currentPeriodEnd ?? undefined,
          },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const stripeSubscriptionId = (invoice.subscription || '').toString();
        if (!stripeSubscriptionId) break;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: { status: 'past_due' },
        });
        break;
      }
      default:
        break;
    }

    logger.info({ type: event.type, id: event.id }, '[stripe] webhook processed');
    return { received: true };
  },
};

