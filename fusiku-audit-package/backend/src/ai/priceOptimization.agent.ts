/**
 * AI Price Optimization Agent
 * Analyzes sales and inventory trends to recommend optimal selling price
 */
import { prisma } from '../utils/prisma';
import { priceEstimatorService } from './priceEstimator.service';

export interface PriceOptimizationResult {
  recommendedPrice: number;
  confidenceScore: number;
  status: 'overpriced' | 'underpriced' | 'optimal';
  suggestion: string;
  factors: string[];
}

export const priceOptimizationAgent = {
  async optimize(params: {
    brand: string;
    model: string;
    storage?: string;
    condition?: string;
    currentPrice: number;
    inventoryAgeDays?: number;
    companyId?: string;
    branchId?: string;
  }): Promise<PriceOptimizationResult> {
    const factors: string[] = [];
    const companyId = String(params.companyId || '').trim();
    if (!companyId) {
      return {
        recommendedPrice: Math.round(Number(params.currentPrice) || 0),
        confidenceScore: 0.1,
        status: 'optimal',
        suggestion: 'Tenant context missing',
        factors: ['Tenant context missing'],
      };
    }
    const where: any = {
      companyId,
      brand: { equals: params.brand },
      model: { equals: params.model }
    };
    if (params.branchId) where.branchId = params.branchId;

    const [baseEstimate, salesHistory, inventoryAge] = await Promise.all([
      priceEstimatorService.estimate({
        brand: params.brand,
        model: params.model,
        storage: params.storage,
        condition: params.condition,
        companyId
      }),
      prisma.saleItem.findMany({
        where: { inventory: where },
        include: { sale: true, inventory: true },
        take: 20,
        orderBy: { sale: { createdAt: 'desc' } }
      }),
      params.inventoryAgeDays
    ]);

    let recommendedPrice = baseEstimate.recommendedPrice;
    let confidence = baseEstimate.confidence;

    if (salesHistory.length > 0) {
      const avgSalePrice = salesHistory.reduce((s, si) => s + Number(si.sellingPrice), 0) / salesHistory.length;
      recommendedPrice = Math.round((recommendedPrice * 0.6 + avgSalePrice * 0.4));
      confidence = Math.min(0.95, confidence + 0.1);
      factors.push(`Historical sales: ${salesHistory.length} items, avg $${avgSalePrice.toFixed(0)}`);
    }

    if (inventoryAge !== undefined && inventoryAge > 90) {
      recommendedPrice = Math.round(recommendedPrice * 0.92);
      factors.push(`Inventory age: ${inventoryAge} days - consider discount`);
    }

    const diff = recommendedPrice - params.currentPrice;
    const diffPct = params.currentPrice > 0 ? (diff / params.currentPrice) * 100 : 0;

    let status: 'overpriced' | 'underpriced' | 'optimal' = 'optimal';
    let suggestion = 'Price is optimal';

    if (diffPct < -10) {
      status = 'overpriced';
      suggestion = `Consider reducing price by ${Math.abs(diffPct).toFixed(0)}% to improve sales`;
    } else if (diffPct > 10) {
      status = 'underpriced';
      suggestion = `Consider increasing price by ${diffPct.toFixed(0)}% to maximize profit`;
    }

    return {
      recommendedPrice,
      confidenceScore: confidence,
      status,
      suggestion,
      factors: factors.length ? factors : baseEstimate.factors
    };
  }
};
