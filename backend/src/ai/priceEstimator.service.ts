/**
 * AI Price Estimator - Resale price estimation
 * Inputs: brand, model, storage, condition, market trends
 */
import { prisma } from '../utils/prisma';

export interface PriceEstimate {
  minPrice: number;
  maxPrice: number;
  recommendedPrice: number;
  confidence: number;
  factors: string[];
}

const CONDITION_MULTIPLIER: Record<string, number> = {
  'A+': 1.0,
  'A': 0.92,
  'B': 0.82,
  'C': 0.68,
  'D': 0.5,
  new: 1.05,
  refurbished: 0.95,
  used: 0.85
};

export const priceEstimatorService = {
  async estimate(params: {
    brand: string;
    model: string;
    storage?: string;
    condition?: string;
    purchasePrice?: number;
  }): Promise<PriceEstimate> {
    const factors: string[] = [];
    let basePrice = 0;

    const marketPrice = await prisma.marketPrice.findFirst({
      where: {
        brand: { equals: params.brand },
        model: { equals: params.model },
        storage: params.storage || undefined
      }
    });

    if (marketPrice) {
      basePrice = Number(marketPrice.averagePrice);
      factors.push('Market price data');
    }

    if (!basePrice && params.purchasePrice) {
      basePrice = params.purchasePrice * 1.25;
      factors.push('Purchase price markup');
    }

    if (!basePrice) {
      const recentSale = await prisma.saleItem.findFirst({
        where: {
          inventory: {
            brand: { equals: params.brand },
            model: { equals: params.model }
          }
        },
        include: { sale: true, inventory: true }
      });
      if (recentSale) {
        basePrice = Number(recentSale.sellingPrice);
        factors.push('Historical sale price');
      }
    }

    if (!basePrice) {
      const invAgg = await prisma.inventory.aggregate({
        where: {
          brand: { equals: params.brand },
          model: { equals: params.model }
        },
        _avg: { sellingPrice: true }
      });
      if (invAgg._avg && invAgg._avg.sellingPrice) {
        basePrice = Number(invAgg._avg.sellingPrice);
        factors.push('Inventory average');
      }
    }

    if (!basePrice) {
      basePrice = 300;
      factors.push('Default baseline');
    }

    const conditionKey = (params.condition || 'B').replace(/\s/g, '').toLowerCase();
    const mult = CONDITION_MULTIPLIER[conditionKey] ?? CONDITION_MULTIPLIER['B'];
    const recommendedPrice = Math.round(basePrice * mult);
    const minPrice = Math.round(recommendedPrice * 0.9);
    const maxPrice = Math.round(recommendedPrice * 1.15);

    factors.push(`Condition: ${params.condition || 'B'} (${(mult * 100).toFixed(0)}%)`);

    const confidence = marketPrice ? 0.9 : params.purchasePrice ? 0.75 : 0.5;

    return {
      minPrice,
      maxPrice,
      recommendedPrice,
      confidence,
      factors
    };
  }
};
