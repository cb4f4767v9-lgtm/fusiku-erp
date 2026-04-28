/**
 * AI Alert System
 * Creates intelligent alerts for management
 */
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export type AlertType = 'high_profit' | 'repair_spike' | 'fast_selling' | 'inventory_risk' | 'price_optimization' | 'anomaly';

export const aiAlertAgent = {
  async createAlert(companyId: string, type: AlertType, title: string, message: string, severity: 'info' | 'warning' | 'success' = 'info', data?: object) {
    await prisma.aIAlert.create({
      data: { companyId, type, title, message, severity, data: data as any }
    });
    logger.info({ type, title }, 'AI Alert created');
  },

  async generateAlerts(params: { companyId: string }) {
    const companyId = String(params.companyId || '').trim();
    if (!companyId) {
      throw new Error('companyId is required for generateAlerts');
    }

    const [sales, repairs, inventory, expensesMonth, profitMonth] = await Promise.all([
      prisma.sale.findMany({
        where: { companyId },
        include: { saleItems: { include: { inventory: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.repair.findMany({
        where: { companyId, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.inventory.findMany({
        where: { companyId, status: 'available' },
        include: { branch: true }
      }),
      prisma.expense.aggregate({
        where: {
          companyId,
          expenseDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        },
        _sum: { amountUsd: true, amount: true }
      }),
      prisma.sale.aggregate({
        where: {
          companyId,
          status: 'completed',
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        },
        _sum: { profitUsd: true, profit: true }
      })
    ]);

    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentSales = sales.filter(s => new Date(s.createdAt) >= last7Days);
    const recentRepairs = repairs.filter(r => new Date(r.createdAt) >= last7Days);

    const modelSales: Record<string, number> = {};
    for (const s of recentSales) {
      for (const item of s.saleItems) {
        const inv = (item as any).inventory;
        const key = `${inv?.brand}|${inv?.model}`;
        modelSales[key] = (modelSales[key] || 0) + 1;
      }
    }

    const fastSelling = Object.entries(modelSales).filter(([, v]) => v >= 3);
    if (fastSelling.length > 0) {
      const [model, count] = fastSelling[0];
      const [brand, modelName] = model.split('|');
      await this.createAlert(companyId, 'fast_selling', 'Device selling faster than expected', `${brand} ${modelName} sold ${count} times in last 7 days`, 'success', { brand, model: modelName, count });
    }

    if (recentRepairs.length >= 5) {
      const faultCounts: Record<string, number> = {};
      for (const r of recentRepairs) {
        faultCounts[r.faultDescription] = (faultCounts[r.faultDescription] || 0) + 1;
      }
      const topFault = Object.entries(faultCounts).sort((a, b) => b[1] - a[1])[0];
      if (topFault && topFault[1] >= 3) {
        await this.createAlert(companyId, 'repair_spike', 'Unusual repair spike detected', `${topFault[0]}: ${topFault[1]} repairs in last 7 days`, 'warning', { fault: topFault[0], count: topFault[1] });
      }
    }

    const highProfitItems = recentSales.filter(s => Number(s.profit) > 200);
    if (highProfitItems.length >= 2) {
      await this.createAlert(companyId, 'high_profit', 'High profit opportunity detected', `${highProfitItems.length} sales with profit >$200 in last 7 days`, 'success', { count: highProfitItems.length });
    }

    // Low profit warning (today)
    const salesToday = recentSales.filter(s => new Date(s.createdAt) >= new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const todayRevenue = salesToday.reduce((a, s) => a + Number((s as any).totalAmountUsd ?? (s as any).totalAmount ?? 0), 0);
    const todayProfit = salesToday.reduce((a, s) => a + Number((s as any).profitUsd ?? (s as any).profit ?? 0), 0);
    const margin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;
    if (todayRevenue > 0 && margin < 8) {
      await this.createAlert(
        companyId,
        'inventory_risk',
        'Low profit warning (today)',
        `Today margin is ${margin.toFixed(1)}% (profit $${todayProfit.toFixed(0)} on sales $${todayRevenue.toFixed(0)}).`,
        margin < 3 ? 'warning' : 'info',
        { marginPct: margin, todayRevenue, todayProfit }
      );
    }

    // High expense alert (month-to-date)
    const mtdExpense = Number((expensesMonth as any)?._sum?.amountUsd ?? (expensesMonth as any)?._sum?.amount ?? 0);
    const mtdProfit = Number((profitMonth as any)?._sum?.profitUsd ?? (profitMonth as any)?._sum?.profit ?? 0);
    if (mtdExpense > 0 && (mtdProfit <= 0 || mtdExpense / Math.max(1, mtdProfit) > 0.9)) {
      await this.createAlert(
        companyId,
        'inventory_risk',
        'High expense alert (MTD)',
        `MTD expenses $${mtdExpense.toFixed(0)} vs MTD profit $${mtdProfit.toFixed(0)}.`,
        mtdProfit <= 0 ? 'warning' : 'info',
        { mtdExpense, mtdProfit }
      );
    }

    const oldInventory = inventory.filter(i => {
      const days = (now.getTime() - new Date(i.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      return days > 90;
    });
    if (oldInventory.length >= 5) {
      await this.createAlert(companyId, 'inventory_risk', 'Slow-moving inventory detected', `${oldInventory.length} devices in stock over 90 days - consider discounts or transfers`, 'warning', { count: oldInventory.length });
    }
  },

  async getAlerts(params?: { companyId?: string; limit?: number }): Promise<any[]> {
    const companyId = String(params?.companyId || '').trim();
    if (!companyId) {
      throw new Error('companyId is required for getAlerts');
    }
    const where: any = { companyId };

    return prisma.aIAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params?.limit ?? 20
    });
  },

  async markRead(id: string, companyId: string) {
    return prisma.aIAlert.updateMany({
      where: { id, companyId },
      data: { isRead: true }
    });
  }
};
