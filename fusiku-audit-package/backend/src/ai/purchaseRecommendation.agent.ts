/**
 * AI Purchase Recommendation Agent
 * Analyzes sales and profit to recommend profitable devices to purchase
 */
import { prisma } from '../utils/prisma';

export interface PurchaseRecommendation {
  brand: string;
  model: string;
  storage?: string;
  score: number;
  reason: string;
  salesCount: number;
  avgProfitMargin: number;
  avgRepairCost: number;
}

export const purchaseRecommendationAgent = {
  async getRecommendations(params?: { companyId?: string; limit?: number }): Promise<PurchaseRecommendation[]> {
    const limit = params?.limit ?? 10;
    const companyId = String(params?.companyId || '').trim();
    if (!companyId) return [];
    const where: any = { companyId };

    const sales = await prisma.sale.findMany({
      where,
      include: { saleItems: { include: { inventory: true } } }
    });

    const modelStats: Record<string, { brand: string; model: string; storage?: string; count: number; totalProfit: number; totalRepair: number }> = {}; 
    for (const sale of sales) {
      for (const item of sale.saleItems) {
        const inv = (item as any).inventory;
        const key = `${inv?.brand || ''}|${inv?.model || ''}|${inv?.storage || ''}`;
        if (!modelStats[key]) modelStats[key] = { brand: inv?.brand || '', model: inv?.model || '', storage: inv?.storage, count: 0, totalProfit: 0, totalRepair: 0 };
        modelStats[key].count++;
        modelStats[key].totalProfit += Number(item.profit || 0);
      }
    }

    const repairs = await prisma.repair.findMany({ where: { companyId, status: 'completed' } });
    const repairByModel: Record<string, number[]> = {};
    for (const r of repairs) {
      const inv = await prisma.inventory.findFirst({ where: { companyId, imei: r.imei } });
      const key = inv ? `${inv.brand}|${inv.model}|${inv.storage || ''}` : 'unknown';
      if (!repairByModel[key]) repairByModel[key] = [];
      repairByModel[key].push(Number(r.repairCost));
    }

    const marketPrices = await prisma.marketPrice.findMany();

    const recommendations: PurchaseRecommendation[] = [];

    for (const [key, stats] of Object.entries(modelStats)) {
      if (stats.count < 2) continue;
      const [brand, model, storage] = key.split('|');
      const avgProfit = stats.totalProfit / stats.count;
      const repairCosts = repairByModel[key] || [];
      const avgRepairCost = repairCosts.length > 0 ? repairCosts.reduce((a, b) => a + b, 0) / repairCosts.length : 0;

      const marketPrice = marketPrices.find(m => 
        m.brand.toLowerCase() === brand?.toLowerCase() && 
        m.model.toLowerCase() === model?.toLowerCase()
      );
      const marketVal = marketPrice ? Number(marketPrice.averagePrice) : 0;

      const score = (stats.count * 2) + (avgProfit / 50) - (avgRepairCost / 100) + (marketVal > 0 ? 1 : 0);
      const margin = avgProfit > 0 ? (avgProfit / (marketVal || 300)) * 100 : 0;

      recommendations.push({
        brand,
        model,
        storage: storage || undefined,
        score: Math.round(score * 10) / 10,
        reason: `Sold ${stats.count} units, avg profit $${avgProfit.toFixed(0)} (${margin.toFixed(0)}% margin)`,
        salesCount: stats.count,
        avgProfitMargin: margin,
        avgRepairCost
      });
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
};
