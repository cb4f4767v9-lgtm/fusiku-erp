import { prisma } from '../utils/prisma';

export interface RepairPattern {
  faultDescription: string;
  count: number;
  avgCost: number;
  models: string[];
}

export interface TechnicianEfficiency {
  technicianId: string;
  technicianName: string;
  completedCount: number;
  avgCost: number;
  completionRate: number;
}

export const repairPatternAgent = {
  async analyze(params?: { companyId?: string }) {
    const companyId = String(params?.companyId || '').trim();
    if (!companyId) return { patterns: [], technicianEfficiency: [] };

    const repairs = await prisma.repair.findMany({
      where: { companyId, status: 'completed' },
      select: { faultDescription: true, repairCost: true, imei: true }
    });

    const imeis = Array.from(
      new Set(repairs.map(r => String(r.imei || '').trim()).filter(Boolean))
    );

    const inventories = imeis.length
      ? await prisma.inventory.findMany({
          where: { companyId, imei: { in: imeis } },
          select: { imei: true }
        })
      : [];

    const inventoryByImei = new Map(
      inventories.map(i => [String(i.imei || '').trim(), i])
    );

    const faultGroups: Record<string, { count: number; totalCost: number; models: Set<string> }> = {};

    for (const r of repairs) {
      const fault = r.faultDescription?.trim() || 'Unknown';

      if (!faultGroups[fault]) {
        faultGroups[fault] = { count: 0, totalCost: 0, models: new Set() };
      }

      faultGroups[fault].count++;
      faultGroups[fault].totalCost += Number(r.repairCost);

      const inv = inventoryByImei.get(String(r.imei || '').trim());
      if (inv) {
        faultGroups[fault].models.add('Unknown Model');
      }
    }

    const patterns = Object.entries(faultGroups)
      .map(([fault, data]) => ({
        faultDescription: fault,
        count: data.count,
        avgCost: data.count > 0 ? data.totalCost / data.count : 0,
        models: Array.from(data.models)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return { patterns, technicianEfficiency: [] };
  }
};