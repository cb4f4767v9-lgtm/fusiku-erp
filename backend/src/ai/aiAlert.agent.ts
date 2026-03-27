/**
 * AI Alert System
 * Creates intelligent alerts for management
 */
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export type AlertType = 'high_profit' | 'repair_spike' | 'fast_selling' | 'inventory_risk' | 'price_optimization';

export const aiAlertAgent = {
  async createAlert(companyId: string, type: AlertType, title: string, message: string, severity: 'info' | 'warning' | 'success' = 'info', data?: object) {
    await prisma.aIAlert.create({
      data: { companyId, type, title, message, severity, data: data as any }
    });
    logger.info({ type, title }, 'AI Alert created');
  },

  async generateAlerts(params: { companyId: string }) {
    const companyId = params.companyId;

    const [sales, repairs, inventory] = await Promise.all([
      prisma.sale.findMany({
        where: companyId ? { companyId } : {},
        include: { saleItems: { include: { inventory: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.repair.findMany({
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.inventory.findMany({
        where: { status: 'available' },
        include: { branch: true }
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

    const oldInventory = inventory.filter(i => {
      const days = (now.getTime() - new Date(i.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      return days > 90;
    });
    if (oldInventory.length >= 5) {
      await this.createAlert(companyId, 'inventory_risk', 'Slow-moving inventory detected', `${oldInventory.length} devices in stock over 90 days - consider discounts or transfers`, 'warning', { count: oldInventory.length });
    }
  },

  async getAlerts(params?: { companyId?: string; limit?: number }): Promise<any[]> {
    const where: any = {};
    if (params?.companyId) where.companyId = params.companyId;

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
