import { prisma } from '../utils/prisma';
import { priceEstimatorService } from '../ai/priceEstimator.service';

async function getDashboard(branchId?: string, companyId?: string | null) {
  const where: any = branchId ? { branchId } : {};
  if (companyId && !branchId) where.branch = { companyId };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalInventory,
    availableInventory,
    totalSalesAgg,
    totalPurchasesAgg,
    recentSales,
    inventoryValue,
    dailySales,
    monthlyProfit,
    devicesUnderRepair,
    lowStockCount
  ] = await Promise.all([
    prisma.inventory.count({ where }),
    prisma.inventory.count({ where: { ...where, status: 'available' } }),
    prisma.sale.aggregate({ where: { ...where }, _sum: { totalAmount: true, profit: true } }),
    prisma.purchase.aggregate({ where: { ...where }, _sum: { totalAmount: true } }),
    prisma.sale.findMany({
      where: { ...where },
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.inventory.aggregate({
      where: { ...where, status: 'available' },
      _sum: { sellingPrice: true }
    }),
    prisma.sale.aggregate({
      where: { ...where, createdAt: { gte: today } },
      _sum: { totalAmount: true }
    }),
    prisma.sale.aggregate({
      where: { ...where, createdAt: { gte: monthStart } },
      _sum: { profit: true }
    }),
    prisma.inventory.count({ where: { ...where, status: 'in_repair' } }),
    prisma.inventory.groupBy({
      by: ['brand', 'model'],
      where: { ...where, status: 'available' },
      _count: { id: true }
    })
  ]);

  const lowStock = (lowStockCount as any[]).filter((g) => g._count.id < 3).length;
  const repairWhere: any = companyId ? { companyId } : {};
  const repairsInProgress = await prisma.repair.count({
    where: { ...repairWhere, status: { in: ['received', 'diagnosing', 'waiting_parts', 'repairing', 'testing'] } }
  });
  const refurbishingQueue = await prisma.refurbishJob.count({ where: { status: { in: ['pending', 'in_progress'] } } });

  return {
    totalInventory,
    availableInventory,
    totalSales: Number(totalSalesAgg._sum.totalAmount || 0),
    totalProfit: Number(totalSalesAgg._sum.profit || 0),
    totalPurchases: Number(totalPurchasesAgg._sum.totalAmount || 0),
    recentSales,
    totalInventoryValue: Number(inventoryValue._sum.sellingPrice || 0),
    dailySales: Number(dailySales._sum.totalAmount || 0),
    monthlyProfit: Number(monthlyProfit._sum.profit || 0),
    devicesUnderRepair,
    lowStockAlerts: lowStock,
    repairsInProgress,
    refurbishingQueue,
    totalDevicesInStock: totalInventory,
    todaySales: Number(dailySales._sum.totalAmount || 0)
  };
}

async function getSalesReport(filters?: {
  branchId?: string;
  companyId?: string | null;
  startDate?: Date;
  endDate?: Date;
  brand?: string;
  model?: string;
}) {
  const where: any = filters?.branchId ? { branchId: filters.branchId } : {};
  if (filters?.companyId) where.companyId = filters.companyId;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters?.startDate) where.createdAt.gte = filters.startDate;
    if (filters?.endDate) where.createdAt.lte = filters.endDate;
  }
  const sales = await prisma.sale.findMany({
    where,
    include: { branch: true, customer: true, saleItems: { include: { inventory: true } } },
    orderBy: { createdAt: 'desc' }
  });
  let filtered = sales;
  if (filters?.brand || filters?.model) {
    filtered = sales.filter((s) => {
      const items = (s as any).saleItems || [];
      return items.some(
        (i: any) =>
          (!filters?.brand || (i.inventory?.brand || '').toLowerCase().includes((filters!.brand || '').toLowerCase())) &&
          (!filters?.model || (i.inventory?.model || '').toLowerCase().includes((filters!.model || '').toLowerCase()))
      );
    });
  }
  return filtered;
}

async function getInventoryReport(branchId?: string, filters?: { brand?: string; model?: string }) {
  const where: any = branchId ? { branchId } : {};
  if (filters?.brand) where.brand = { contains: filters.brand };
  if (filters?.model) where.model = { contains: filters.model };
  return prisma.inventory.findMany({
    where,
    include: { branch: true },
    orderBy: { createdAt: 'desc' }
  });
}

async function getProfitReport(filters?: {
  branchId?: string;
  companyId?: string | null;
  startDate?: Date;
  endDate?: Date;
  brand?: string;
}) {
  const where: any = filters?.branchId ? { branchId: filters.branchId } : {};
  if (filters?.companyId) where.companyId = filters.companyId;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters?.startDate) where.createdAt.gte = filters.startDate;
    if (filters?.endDate) where.createdAt.lte = filters.endDate;
  }
  const sales = await prisma.sale.findMany({
    where,
    include: { saleItems: true }
  });
  const totalRevenue = sales.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
  const totalProfit = sales.reduce((s, x) => s + Number(x.profit || 0), 0);
  return { sales, totalRevenue, totalProfit };
}

async function getTechniciansReport(filters?: { startDate?: Date; endDate?: Date }) {
  const where: any = {};
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters?.startDate) where.createdAt.gte = filters.startDate;
    if (filters?.endDate) where.createdAt.lte = filters.endDate;
  }
  const repairs = await prisma.repair.findMany({
    where,
    include: { technician: true }
  });
  const byTech: Record<string, { count: number; totalCost: number }> = {};
  for (const r of repairs) {
    const name = r.technician?.name || 'Unknown';
    if (!byTech[name]) byTech[name] = { count: 0, totalCost: 0 };
    byTech[name].count++;
    byTech[name].totalCost += Number(r.repairCost || 0);
  }
  return Object.entries(byTech).map(([name, data]) => ({ technician: name, ...data }));
}

async function getInventoryFinancialSummary(branchId?: string) {
  const where: any = branchId ? { branchId } : {};
  const [purchaseSum, sellingSum] = await Promise.all([
    prisma.inventory.aggregate({ where: { ...where, status: 'available' }, _sum: { purchasePrice: true } }),
    prisma.inventory.aggregate({ where: { ...where, status: 'available' }, _sum: { sellingPrice: true } })
  ]);
  const totalCost = Number(purchaseSum._sum.purchasePrice || 0);
  const totalValue = Number(sellingSum._sum.sellingPrice || 0);
  return { totalCost, totalValue, potentialProfit: totalValue - totalCost };
}

async function getInventoryMarketValue(branchId?: string, companyId?: string | null) {
  const where: any = { status: 'available' };
  if (branchId) where.branchId = branchId;
  if (companyId && !branchId) where.branch = { companyId };

  const items = await prisma.inventory.findMany({
    where,
    select: {
      brand: true,
      model: true,
      storage: true,
      condition: true,
      purchasePrice: true,
      sellingPrice: true
    }
  });

  let totalPurchaseValue = 0;
  items.forEach((item) => {
    totalPurchaseValue += Number(item.purchasePrice || 0);
  });

  const estimates = await Promise.all(
    items.map((item) =>
      priceEstimatorService.estimate({
        brand: item.brand,
        model: item.model,
        storage: item.storage,
        condition: item.condition,
        purchasePrice: Number(item.purchasePrice || 0)
      })
    )
  );

  const estimatedResaleValue = estimates.reduce((sum, e) => sum + e.recommendedPrice, 0);
  const expectedProfit = estimatedResaleValue - totalPurchaseValue;
  const expectedProfitMargin = totalPurchaseValue > 0 ? (expectedProfit / totalPurchaseValue) * 100 : 0;

  return {
    totalInventoryValue: totalPurchaseValue,
    estimatedResaleValue: Math.round(estimatedResaleValue * 100) / 100,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    expectedProfitMargin: Math.round(expectedProfitMargin * 100) / 100
  };
}

async function getTopSellingModels(branchId?: string, limit = 10) {
  const where: any = branchId ? { branchId } : {};
  const items = await prisma.saleItem.findMany({
    where: { sale: where },
    include: { inventory: true }
  });
  const counts: Record<string, { brand: string; model: string; count: number }> = {};
  for (const i of items) {
    const inv = (i as any).inventory;
    const key = `${inv?.brand || ''}|${inv?.model || ''}`;
    if (!counts[key]) counts[key] = { brand: inv?.brand || '', model: inv?.model || '', count: 0 };
    counts[key].count++;
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function getTopTechnicians(limit = 10) {
  const repairs = await prisma.repair.findMany({ include: { technician: true } });
  const byTech: Record<string, number> = {};
  for (const r of repairs) {
    const name = r.technician?.name || 'Unknown';
    byTech[name] = (byTech[name] || 0) + 1;
  }
  return Object.entries(byTech)
    .map(([technician, count]) => ({ technician, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function getMonthlyRevenue(branchId?: string, months = 12) {
  const where: any = branchId ? { branchId } : {};
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const sales = await prisma.sale.findMany({
    where: { ...where, createdAt: { gte: start } },
    select: { createdAt: true, totalAmount: true }
  });
  const byMonth: Record<string, number> = {};
  for (const s of sales) {
    const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + Number(s.totalAmount || 0);
  }
  return Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));
}

async function getInventoryCategoryDistribution(branchId?: string) {
  const where: any = branchId ? { branchId } : {};
  const items = await prisma.inventory.findMany({
    where: { ...where, status: 'available' },
    select: { brand: true, model: true }
  });
  const byBrand: Record<string, number> = {};
  for (const i of items) {
    byBrand[i.brand] = (byBrand[i.brand] || 0) + 1;
  }
  return Object.entries(byBrand).map(([brand, count]) => ({ brand, count }));
}

async function getInventoryAging(branchId?: string) {
  const where: any = branchId ? { branchId } : {};
  const items = await prisma.inventory.findMany({
    where: { ...where, status: 'available' },
    select: { id: true, imei: true, brand: true, model: true, createdAt: true, sellingPrice: true }
  });
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return items.map((i) => ({
    ...i,
    ageDays: Math.floor((now - new Date(i.createdAt).getTime()) / dayMs)
  }));
}

export const reportService = {
  getDashboard,
  getSalesReport,
  getInventoryReport,
  getProfitReport,
  getTechniciansReport,
  getInventoryFinancialSummary,
  getInventoryMarketValue,
  getTopSellingModels,
  getTopTechnicians,
  getMonthlyRevenue,
  getInventoryCategoryDistribution,
  getInventoryAging
};
