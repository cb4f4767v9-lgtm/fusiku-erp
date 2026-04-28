import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { reportService } from '../services/report.service';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { assertBranchQueryAllowed } from '../utils/branchAccess';

export const reportController = {
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      logger.info({ companyId: req.user?.companyId ?? null, branchId: branchId ?? null }, '[report] GET /reports/dashboard start');

      const dashboard = await reportService.getDashboard(
        branchId,
        req.user?.companyId
      );

      logger.info({ companyId: req.user?.companyId ?? null }, '[report] GET /reports/dashboard done');
      res.json(dashboard);

    } catch (e: any) {
      if (e.statusCode === 403) {
        return res.status(403).json({ error: e.message });
      }
      logger.error({ err: e, stack: e?.stack }, '[report] dashboard error — returning empty fallback');

      // SAFE FALLBACK so frontend never breaks
      res.json({
        totalInventory: 0,
        availableInventory: 0,
        totalSales: 0,
        totalProfit: 0,
        totalPurchases: 0,
        recentSales: [],
        totalInventoryValue: 0,
        dailySales: 0,
        todayProfit: 0,
        monthlyProfit: 0,
        devicesUnderRepair: 0,
        lowStockAlerts: 0,
        repairsInProgress: 0,
        refurbishingQueue: 0,
        totalDevicesInStock: 0,
        todaySales: 0,
        branchProfitRows: [],
        companyNetProfitMonth: 0,
        monthlyOperatingExpenses: 0,
        dataQuality: { hasLegacyCost: false, hasMissingFx: false },
        reportingNotice: null
      });

    }
  },

  async getSalesReport(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const filters = {
        branchId,
        companyId: req.user?.companyId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        brand: req.query.brand as string,
        model: req.query.model as string
      };
      const sales = await reportService.getSalesReport(filters);
      res.json(sales);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryReport(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const filters = { brand: req.query.brand as string, model: req.query.model as string };
      const report = await reportService.getInventoryReport(branchId, filters);
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getProfitReport(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const filters = {
        branchId,
        companyId: req.user?.companyId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        brand: req.query.brand as string
      };
      const report = await reportService.getProfitReport(filters);
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getExpenseReport(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const report = await reportService.getExpenseReport({
        branchId,
        companyId: req.user?.companyId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      });
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getBranchComparison(req: AuthRequest, res: Response) {
    try {
      if (req.user?.branchId) {
        return res.status(403).json({ error: 'Branch comparison is only available for head office users.' });
      }
      const rows = await reportService.getBranchComparison({
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      });
      res.json(rows);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getTechniciansReport(req: AuthRequest, res: Response) {
    try {
      const filters = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };
      const report = await reportService.getTechniciansReport(filters);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryAging(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const report = await reportService.getInventoryAging(branchId);
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryFinancial(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const report = await reportService.getInventoryFinancialSummary(branchId);
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryMarketValue(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const report = await reportService.getInventoryMarketValue(branchId, req.user?.companyId);
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async getTopSellingModels(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const limit = parseInt(req.query.limit as string) || 10;
      logger.info(
        { companyId: req.user?.companyId ?? null, branchId: branchId ?? null, limit },
        '[report] GET /reports/top-selling-models start'
      );
      const report = await reportService.getTopSellingModels(branchId, limit);
      logger.info({ companyId: req.user?.companyId ?? null }, '[report] GET /reports/top-selling-models done');
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      logger.error({ err: e, stack: e?.stack }, '[report] top-selling-models error — returning empty fallback');
      res.json([]);
    }
  },

  async getTopTechnicians(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const report = await reportService.getTopTechnicians(limit);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getMonthlyRevenue(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const months = parseInt(req.query.months as string) || 12;
      logger.info(
        { companyId: req.user?.companyId ?? null, branchId: branchId ?? null, months },
        '[report] GET /reports/monthly-revenue start'
      );
      const report = await reportService.getMonthlyRevenue(branchId, months, req.user?.companyId);
      logger.info({ companyId: req.user?.companyId ?? null }, '[report] GET /reports/monthly-revenue done');
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      logger.error({ err: e, stack: e?.stack }, '[report] monthly-revenue error — returning empty fallback');
      res.json({ months: [], dataQuality: { hasLegacyCost: false, hasMissingFx: false } });
    }
  },

  async getInventoryDistribution(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const report = await reportService.getInventoryCategoryDistribution(branchId);
      res.json(report);
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async exportSales(req: AuthRequest, res: Response) {
    try {
      const format = (req.query.format as string) || 'csv';
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const filters = {
        branchId,
        companyId: req.user?.companyId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };
      const { sales } = await reportService.getSalesReport(filters);
      if (format === 'excel') {
        const XLSX = await import('xlsx');
        const rows = sales.flatMap((s) =>
          (s as any).saleItems.map((i: any) => ({
            SaleID: s.id,
            Date: s.createdAt,
            Branch: (s as any).branch?.name,
            Customer: (s as any).customer?.name,
            Total: s.totalAmount,
            Profit: s.profit,
            IMEI: i.imei,
            Brand: (i as any).inventory?.brand,
            Model: (i as any).inventory?.model
          }))
        );
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: 'No data' }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-export.xlsx');
        res.send(buf);
      } else {
        const headers = 'SaleID,Date,Branch,Customer,Total,Profit,IMEI,Brand,Model';
        const rows = sales.flatMap((s: any) =>
          (s as any).saleItems.map((i: any) =>
            [s.id, s.createdAt, (s as any).branch?.name, (s as any).customer?.name, s.totalAmount, s.profit, i.imei, (i as any).inventory?.brand, (i as any).inventory?.model].join(',')
          )
        );
        const csv = [headers, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-export.csv');
        res.send(csv);
      }
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  },

  async exportInventory(req: AuthRequest, res: Response) {
    try {
      const format = (req.query.format as string) || 'csv';
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const inventory = await prisma.inventory.findMany({
        // Never trust branchId from query for branch-assigned users (assertBranchQueryAllowed enforces this).
        where: branchId ? { branchId } : {},
        include: { branch: true }
      });
      if (format === 'excel') {
        const XLSX = await import('xlsx');
        const rows = inventory.map((i) => ({
          IMEI: i.imei,
          Brand: i.brand,
          Model: i.model,
          Storage: i.storage,
          Color: i.color,
          Condition: i.condition,
          PurchasePrice: i.purchasePrice,
          SellingPrice: i.sellingPrice,
          Status: i.status,
          Branch: (i as any).branch?.name,
          CreatedAt: i.createdAt
        }));
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: 'No data' }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.xlsx');
        res.send(buf);
      } else {
        const headers = 'IMEI,Brand,Model,Storage,Color,Condition,PurchasePrice,SellingPrice,Status,Branch,CreatedAt';
        const rows = inventory.map((i) =>
          [i.imei, i.brand, i.model, i.storage, i.color, i.condition, i.purchasePrice, i.sellingPrice, i.status, (i as any).branch?.name, i.createdAt].join(',')
        );
        const csv = [headers, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
        res.send(csv);
      }
    } catch (e: any) {
      if (e.statusCode === 403) return res.status(403).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  }
};
