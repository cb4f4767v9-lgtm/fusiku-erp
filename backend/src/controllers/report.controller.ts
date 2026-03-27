import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { reportService } from '../services/report.service';
import { prisma } from '../utils/prisma';

export const reportController = {
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;

      const dashboard = await reportService.getDashboard(
        branchId,
        req.user?.companyId
      );

      res.json(dashboard);

    } catch (e: any) {

      console.error("Dashboard error:", e);

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
        monthlyProfit: 0,
        devicesUnderRepair: 0,
        lowStockAlerts: 0,
        repairsInProgress: 0,
        refurbishingQueue: 0,
        totalDevicesInStock: 0,
        todaySales: 0
      });

    }
  },

  async getSalesReport(req: AuthRequest, res: Response) {
    try {
      const filters = {
        branchId: req.query.branchId as string,
        companyId: req.user?.companyId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        brand: req.query.brand as string,
        model: req.query.model as string
      };
      const sales = await reportService.getSalesReport(filters);
      res.json(sales);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryReport(req: AuthRequest, res: Response) {
    try {
      const branchId = req.query.branchId as string;
      const filters = { brand: req.query.brand as string, model: req.query.model as string };
      const report = await reportService.getInventoryReport(branchId, filters);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getProfitReport(req: AuthRequest, res: Response) {
    try {
      const filters = {
        branchId: req.query.branchId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        brand: req.query.brand as string
      };
      const report = await reportService.getProfitReport(filters);
      res.json(report);
    } catch (e: any) {
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
      const branchId = req.query.branchId as string;
      const report = await reportService.getInventoryAging(branchId);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryFinancial(req: AuthRequest, res: Response) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const report = await reportService.getInventoryFinancialSummary(branchId);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryMarketValue(req: AuthRequest, res: Response) {
    try {
      const branchId = (req.query.branchId as string) || req.user?.branchId;
      const report = await reportService.getInventoryMarketValue(branchId, req.user?.companyId);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getTopSellingModels(req: AuthRequest, res: Response) {
    try {
      const branchId = req.query.branchId as string;
      const limit = parseInt(req.query.limit as string) || 10;
      const report = await reportService.getTopSellingModels(branchId, limit);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
      const branchId = req.query.branchId as string;
      const months = parseInt(req.query.months as string) || 12;
      const report = await reportService.getMonthlyRevenue(branchId, months);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getInventoryDistribution(req: AuthRequest, res: Response) {
    try {
      const branchId = req.query.branchId as string;
      const report = await reportService.getInventoryCategoryDistribution(branchId);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async exportSales(req: AuthRequest, res: Response) {
    try {
      const format = (req.query.format as string) || 'csv';
      const filters = {
        branchId: req.query.branchId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };
      const sales = await reportService.getSalesReport(filters);
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
        const rows = sales.flatMap((s) =>
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
      res.status(500).json({ error: e.message });
    }
  },

  async exportInventory(req: AuthRequest, res: Response) {
    try {
      const format = (req.query.format as string) || 'csv';
      const branchId = req.query.branchId as string;
      const inventory = await prisma.inventory.findMany({
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
      res.status(500).json({ error: e.message });
    }
  }
};
