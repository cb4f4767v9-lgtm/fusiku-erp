import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';

export const adminController = {
  async getCompanies(req: AuthRequest, res: Response) {
    try {
      const companies = await prisma.company.findMany({
        include: { _count: { select: { users: true, branches: true } } },
        orderBy: { createdAt: 'desc' }
      });
      res.json(companies);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getSystemUsage(req: AuthRequest, res: Response) {
    try {
      const [companies, users, inventory, sales] = await Promise.all([
        prisma.company.count(),
        prisma.user.count(),
        prisma.inventory.count(),
        prisma.sale.count()
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
        data: { isActive: false }
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
        data: { isActive: true }
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
