/**
 * AI Repair Pattern Analyzer
 * Identifies frequent faults and technician efficiency
 */
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
  async analyze(params?: { companyId?: string }): Promise<{
    patterns: RepairPattern[];
    technicianEfficiency: TechnicianEfficiency[];
  }> {
    const companyId = String(params?.companyId || '').trim();
    if (!companyId) return { patterns: [], technicianEfficiency: [] };
    const where: any = { companyId, status: 'completed' };

    const repairs = await prisma.repair.findMany({
      where,
      select: { faultDescription: true, repairCost: true, imei: true }
    });

    const imeis = Array.from(new Set(repairs.map((r) => String(r.imei || '').trim()).filter(Boolean)));
    const inventories = imeis.length
      ? await prisma.inventory.findMany({
          where: { companyId, imei: { in: imeis } },
          select: { imei: true, brand: true, model: true }
        })
      : [];
    const inventoryByImei = new Map(inventories.map((i) => [String(i.imei || '').trim(), i]));

    const faultGroups: Record<string, { count: number; totalCost: number; models: Set<string> }> = {};
    for (const r of repairs) {
      const fault = r.faultDescription?.trim() || 'Unknown';
      if (!faultGroups[fault]) faultGroups[fault] = { count: 0, totalCost: 0, models: new Set() };
      faultGroups[fault].count++;
      faultGroups[fault].totalCost += Number(r.repairCost);
      const inv = inventoryByImei.get(String(r.imei || '').trim());
      if (inv) faultGroups[fault].models.add(`${inv.brand} ${inv.model}`);
    }

    const patterns: RepairPattern[] = Object.entries(faultGroups)
      .map(([fault, data]) => ({
        faultDescription: fault,
        count: data.count,
        avgCost: data.count > 0 ? data.totalCost / data.count : 0,
        models: Array.from(data.models)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const techStats: Record<string, { completed: number; total: number; cost: number }> = {};
    const allRepairs = await prisma.repair.findMany({
      where: { companyId, technicianId: { not: null as any } },
      select: { technicianId: true, status: true, repairCost: true }
    });
    for (const r of allRepairs) {
      const id = r.technicianId || 'unknown';
      if (!techStats[id]) techStats[id] = { completed: 0, total: 0, cost: 0 };
      techStats[id].total++;
      if (r.status === 'completed') techStats[id].completed++;
      techStats[id].cost += Number(r.repairCost);
    }

    const users = await prisma.user.findMany({
      where: { companyId, id: { in: Object.keys(techStats) } },
      select: { id: true, name: true }
    });

    const technicianEfficiency: TechnicianEfficiency[] = Object.entries(techStats).map(([id, s]) => ({
      technicianId: id,
      technicianName: users.find(u => u.id === id)?.name || 'Unknown',
      completedCount: s.completed,
      avgCost: s.completed > 0 ? s.cost / s.completed : 0,
      completionRate: s.total > 0 ? (s.completed / s.total) * 100 : 0
    }));

    return { patterns, technicianEfficiency };
  }
};
