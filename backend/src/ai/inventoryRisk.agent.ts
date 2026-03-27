/**
 * AI Inventory Risk Agent
 * Detects slow-moving or risky inventory
 */
import { prisma } from '../utils/prisma';

export interface InventoryRiskAlert {
  inventoryId: string;
  imei: string;
  brand: string;
  model: string;
  storage: string;
  daysInStock: number;
  riskLevel: 'high' | 'medium' | 'low';
  suggestion: string;
  branchId?: string;
}

export const inventoryRiskAgent = {
  async analyze(params?: { companyId?: string; branchId?: string }): Promise<InventoryRiskAlert[]> {
    const where: any = { status: 'available' };
    if (params?.branchId) where.branchId = params.branchId;
    if (params?.companyId && !params.branchId) where.branch = { companyId: params.companyId };

    const inventory = await prisma.inventory.findMany({
      where,
      include: { branch: true }
    });

    const salesByModel = await prisma.saleItem.findMany({
      include: { inventory: true }
    });
    const modelSalesCount: Record<string, number> = {};
    for (const si of salesByModel) {
      const inv = (si as any).inventory;
      const key = `${inv?.brand}|${inv?.model}|${inv?.storage || ''}`;
      modelSalesCount[key] = (modelSalesCount[key] || 0) + 1;
    }

    const alerts: InventoryRiskAlert[] = [];
    const now = new Date();

    for (const inv of inventory) {
      const daysInStock = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / (24 * 60 * 60 * 1000));
      const modelKey = `${inv.brand}|${inv.model}|${inv.storage || ''}`;
      const salesCount = modelSalesCount[modelKey] || 0;

      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      let suggestion = '';

      if (daysInStock > 90 && salesCount < 3) {
        riskLevel = 'high';
        suggestion = 'Consider discounting device or transferring to another branch';
      } else if (daysInStock > 60 || salesCount < 2) {
        riskLevel = 'medium';
        suggestion = 'Monitor closely; consider promotional pricing';
      }

      if (riskLevel !== 'low') {
        alerts.push({
          inventoryId: inv.id,
          imei: inv.imei,
          brand: inv.brand,
          model: inv.model,
          storage: inv.storage || '',
          daysInStock,
          riskLevel,
          suggestion,
          branchId: inv.branchId
        });
      }
    }

    return alerts.sort((a, b) => (a.riskLevel === 'high' ? 1 : 0) - (b.riskLevel === 'high' ? 1 : 0) || b.daysInStock - a.daysInStock);
  }
};
