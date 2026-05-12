/**
 * Smart Inventory Value Forecast Agent
 * Estimates future inventory value based on sales trends
 */
import { prisma } from '../utils/prisma';

export interface InventoryForecast {
  currentValue: number;
  expectedFutureValue: number;
  expectedChangeDays: number;
  recommendedDiscountTiming: string;
  trend: 'up' | 'down' | 'stable';
}

export const inventoryForecastAgent = {
  async forecast(params?: { companyId?: string; branchId?: string }): Promise<InventoryForecast> {
    const companyId = String(params?.companyId || '').trim();
    if (!companyId) {
      return {
        currentValue: 0,
        expectedFutureValue: 0,
        expectedChangeDays: 0,
        recommendedDiscountTiming: 'Tenant context missing',
        trend: 'stable',
      };
    }
    const where: any = { companyId, status: 'available' };
    if (params?.branchId) where.branchId = params.branchId;

    const [inventory, sales] = await Promise.all([
      prisma.inventory.findMany({ where, select: { sellingPrice: true, purchasePrice: true, createdAt: true } }),
      prisma.sale.findMany({
        where: { companyId },
        include: { saleItems: { include: { inventory: true } } }
      })
    ]);

    const currentValue = inventory.reduce((s, i) => s + Number(i.sellingPrice || 0), 0);

    const now = new Date();
    const last30Days = sales.filter(s => (now.getTime() - new Date(s.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000);
    const avgDailySales = last30Days.length > 0 ? last30Days.reduce((s, sale) => s + (sale.saleItems?.length || 0), 0) / 30 : 0.5;

    const avgItemValue = inventory.length > 0 ? currentValue / inventory.length : 0;
    const daysToSell = avgDailySales > 0 ? inventory.length / avgDailySales : 0;

    const agingFactor = inventory.filter(i => {
      const days = (now.getTime() - new Date(i.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      return days > 60;
    }).length / Math.max(inventory.length, 1);

    const discountFactor = agingFactor > 0.3 ? 0.92 : agingFactor > 0.15 ? 0.96 : 1;
    const expectedFutureValue = Math.round(currentValue * discountFactor);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (last30Days.length > 10 && avgDailySales > 1) trend = 'up';
    else if (agingFactor > 0.3) trend = 'down';

    let recommendedDiscountTiming = 'No immediate discount needed';
    if (agingFactor > 0.4) recommendedDiscountTiming = 'Consider discounting items older than 30 days within 2 weeks';
    else if (agingFactor > 0.2) recommendedDiscountTiming = 'Monitor items over 60 days; consider promotions in 4 weeks';

    return {
      currentValue,
      expectedFutureValue,
      expectedChangeDays: Math.round(daysToSell),
      recommendedDiscountTiming,
      trend
    };
  }
};
