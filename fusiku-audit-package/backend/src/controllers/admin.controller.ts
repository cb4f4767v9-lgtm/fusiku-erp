import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import { companyUsageService } from '../services/companyUsage.service';

export const adminController = {
  async getCompanies(req: AuthRequest, res: Response) {
    try {
      const companies = await prisma.company.findMany({
        include: {
          _count: { select: { users: true, branches: true } },
          subscriptions: {
            take: 1,
            include: { plan: { select: { id: true, name: true, priceMonthly: true } } },
          },
          usage: true,
        } as any,
        orderBy: { createdAt: 'desc' },
      });
      res.json(companies);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getCompany(req: AuthRequest, res: Response) {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Company id required' });
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          subscriptions: {
            take: 1,
            include: { plan: true },
          },
          usage: true,
          _count: { select: { users: true, branches: true, inventory: true } },
        } as any,
      });
      if (!company) return res.status(404).json({ error: 'Company not found' });
      res.json(company);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getCompanyUsage(req: AuthRequest, res: Response) {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Company id required' });
      const usage = await companyUsageService.getUsage(id);
      res.json(usage || { companyId: id, activeUsers: 0, activeBranches: 0, inventoryCount: 0, salesCountMonthly: 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async changeCompanyPlan(req: AuthRequest, res: Response) {
    try {
      const id = String(req.params.id || '').trim();
      const planId = String((req.body as { planId?: unknown })?.planId || '').trim();
      if (!id || !planId) return res.status(400).json({ error: 'company id and planId required' });

      const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } });
      if (!plan) return res.status(404).json({ error: 'Plan not found or inactive' });

      const sub = await prisma.subscription.findUnique({ where: { companyId: id } });
      if (!sub) return res.status(404).json({ error: 'Subscription not found for company' });

      const updated = await prisma.subscription.update({
        where: { companyId: id },
        data: {
          planId,
          status: 'active',
          trialEndsAt: null,
        },
        include: { plan: { select: { id: true, name: true, priceMonthly: true } } },
      });
      void companyUsageService.syncCompanyUsage(id).catch(() => {});
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async getSystemUsage(req: AuthRequest, res: Response) {
    try {
      const [companies, users, inventory, sales] = await Promise.all([
        prisma.company.count(),
        prisma.user.count(),
        prisma.inventory.count(),
        prisma.sale.count(),
      ]);
      res.json({ companies, users, inventory, sales });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async disableCompany(req: AuthRequest, res: Response) {
    try {
      await prisma.company.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async enableCompany(req: AuthRequest, res: Response) {
    try {
      await prisma.company.update({
        where: { id: req.params.id },
        data: { isActive: true },
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
};
