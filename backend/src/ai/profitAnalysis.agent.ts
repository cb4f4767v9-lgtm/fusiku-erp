/**
 * AI Profit Analysis Agent
 * Calculates profitability by model, technician, branch
 */
import { prisma } from '../utils/prisma';

export interface ProfitByModel {
  brand: string;
  model: string;
  totalProfit: number;
  salesCount: number;
  avgProfit: number;
}

export interface ProfitByBranch {
  branchId: string;
  branchName: string;
  totalProfit: number;
  salesCount: number;
}

export interface ProfitByTechnician {
  technicianId: string;
  technicianName: string;
  repairRevenue: number;
  repairCount: number;
  refurbishRevenue: number;
  refurbishCount: number;
}

export const profitAnalysisAgent = {
  async analyze(params?: { companyId?: string }): Promise<{
    topModels: ProfitByModel[];
    topBranches: ProfitByBranch[];
    topTechnicians: ProfitByTechnician[];
  }> {
    const where: any = {};
    if (params?.companyId) where.companyId = params.companyId;

    const sales = await prisma.sale.findMany({
      where,
      include: { saleItems: { include: { inventory: true } }, branch: true }
    });

    const modelProfit: Record<string, { brand: string; model: string; profit: number; count: number }> = {};
    const branchProfit: Record<string, { name: string; profit: number; count: number }> = {};

    for (const sale of sales) {
      const branchKey = sale.branchId || 'unknown';
      if (!branchProfit[branchKey]) branchProfit[branchKey] = { name: sale.branch?.name || 'Unknown', profit: 0, count: 0 };
      branchProfit[branchKey].profit += Number(sale.profit || 0);
      branchProfit[branchKey].count++;

      for (const item of sale.saleItems) {
        const inv = (item as any).inventory;
        const key = `${inv?.brand}|${inv?.model}`;
        if (!modelProfit[key]) modelProfit[key] = { brand: inv?.brand || '', model: inv?.model || '', profit: 0, count: 0 };
        modelProfit[key].profit += Number(item.profit || 0);
        modelProfit[key].count++;
      }
    }

    const [repairs, refurbish] = await Promise.all([
      prisma.repair.groupBy({
        by: ['technicianId'],
        where: { status: 'completed' },
        _sum: { repairCost: true },
        _count: { id: true }
      }),
      prisma.refurbishJob.groupBy({
        by: ['technicianId'],
        where: { status: 'completed' },
        _sum: { laborCost: true },
        _count: { id: true }
      })
    ]);

    const techIds = [...new Set([...repairs.map(r => r.technicianId), ...refurbish.map(r => r.technicianId)])];
    const users = await prisma.user.findMany({ where: { id: { in: techIds } }, select: { id: true, name: true } });

    const topTechnicians: ProfitByTechnician[] = techIds.map(id => {
      const r = repairs.find(x => x.technicianId === id);
      const ref = refurbish.find(x => x.technicianId === id);
      return {
        technicianId: id,
        technicianName: users.find(u => u.id === id)?.name || 'Unknown',
        repairRevenue: Number(r?._sum.repairCost || 0),
        repairCount: r?._count.id || 0,
        refurbishRevenue: Number(ref?._sum.laborCost || 0),
        refurbishCount: ref?._count.id || 0
      };
    });

    const topModels: ProfitByModel[] = Object.values(modelProfit)
      .map(m => ({
        ...m,
        totalProfit: m.profit,
        salesCount: m.count,
        avgProfit: m.count > 0 ? m.profit / m.count : 0
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 10);

    const topBranches: ProfitByBranch[] = Object.entries(branchProfit).map(([id, b]) => ({
      branchId: id,
      branchName: b.name,
      totalProfit: b.profit,
      salesCount: b.count
    })).sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 10);

    return {
      topModels,
      topBranches,
      topTechnicians: topTechnicians.sort((a, b) => (b.repairRevenue + b.refurbishRevenue) - (a.repairRevenue + a.refurbishRevenue)).slice(0, 10)
    };
  }
};
