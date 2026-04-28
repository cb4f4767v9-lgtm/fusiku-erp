import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { deviceIdentificationService } from '../ai/deviceIdentification.service';
import { repairAssistantService } from '../ai/repairAssistant.service';
import { priceEstimatorService } from '../ai/priceEstimator.service';
import { conditionAssistantService } from '../ai/conditionAssistant.service';
import { priceOptimizationAgent } from '../ai/priceOptimization.agent';
import { purchaseRecommendationAgent } from '../ai/purchaseRecommendation.agent';
import { inventoryRiskAgent } from '../ai/inventoryRisk.agent';
import { repairPatternAgent } from '../ai/repairPattern.agent';
import { profitAnalysisAgent } from '../ai/profitAnalysis.agent';
import { inventoryForecastAgent } from '../ai/inventoryForecast.agent';
import { aiAlertAgent } from '../ai/aiAlert.agent';
import { prisma } from '../utils/prisma';
import { aiService } from '../services/ai.service';
import { aiBusinessEngineService, emptyBusinessEngineResponse } from '../aiBusiness/aiBusinessEngine.service';
import { logger } from '../utils/logger';
import { aiSimulationService } from '../aiBusiness/aiSimulation.service';
import { aiContextEngine } from '../aiBusiness/aiContextEngine';
import { smartPricingEngine } from '../aiBusiness/smartPricing';

function isSuperBranchUser(req: AuthRequest): boolean {
  return req.user?.isSystemAdmin === true || req.user?.branchRole === 'SUPER_ADMIN' || !req.user?.branchId;
}

async function resolveEffectiveBranchId(req: AuthRequest, companyId: string, candidate: unknown): Promise<string | null> {
  // Branch roles: never trust incoming branchId.
  if (!isSuperBranchUser(req)) {
    const bid = String(req.user?.branchId || '').trim();
    return bid || null;
  }

  const raw = candidate == null ? '' : String(candidate || '').trim();
  if (!raw) return null;
  const branch = await prisma.branch.findFirst({ where: { id: raw, companyId }, select: { id: true } });
  if (!branch) {
    const e: any = new Error('Invalid branch for this company');
    e.statusCode = 403;
    throw e;
  }
  return raw;
}

export const aiController = {
  async deviceIdentify(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const result = await deviceIdentificationService.identify(req.params.imei, { companyId });
      res.json(result || { brand: '', model: '', storage: '', color: '', source: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async repairSuggestions(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const { model, fault } = req.query;
      if (!model || !fault) return res.status(400).json({ error: 'model and fault required' });
      const result = await repairAssistantService.getSuggestions(model as string, fault as string, { companyId });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async priceEstimate(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const { brand, model, storage, condition, purchasePrice } = req.query;
      if (!brand || !model) return res.status(400).json({ error: 'brand and model required' });
      const result = await priceEstimatorService.estimate({
        brand: brand as string,
        model: model as string,
        storage: storage as string,
        condition: condition as string,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        companyId,
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async conditionSuggest(req: AuthRequest, res: Response) {
    try {
      const { notes } = req.body;
      const result = conditionAssistantService.suggestGrade(notes || '');
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async insights(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const branchId = await resolveEffectiveBranchId(req, companyId, req.query.branchId);
      let where: any = { companyId };
      if (branchId) where = { ...where, branchId };

      const [inventory, repairs, topProfit, frequentFaults] = await Promise.all([
        prisma.inventory.findMany({
          where: { ...where, status: 'available' },
          select: { brand: true, model: true, storage: true, condition: true, purchasePrice: true, sellingPrice: true }
        }),
        prisma.repair.findMany({
          where: { companyId, ...(branchId ? { branchId } : {}), status: 'completed' },
          select: { faultDescription: true, repairCost: true, technicianId: true }
        }),
        prisma.inventory.findMany({
          where: { ...where, status: 'available' },
          select: { brand: true, model: true, sellingPrice: true, purchasePrice: true }
        }),
        prisma.repair.groupBy({
          by: ['faultDescription'],
          where: { companyId, ...(branchId ? { branchId } : {}), status: 'completed' },
          _count: { id: true }
        })
      ]);

      const recommendedPrices = await Promise.all(
        inventory.slice(0, 5).map(async (inv) => {
          const est = await priceEstimatorService.estimate({
            brand: inv.brand,
            model: inv.model,
            storage: inv.storage,
            condition: inv.condition,
            companyId,
          });
          return { ...inv, estimate: est };
        })
      );

      const profitPotential = topProfit
        .map((i) => ({
          ...i,
          potential: Number(i.sellingPrice) - Number(i.purchasePrice),
          margin: Number(i.purchasePrice) > 0
            ? ((Number(i.sellingPrice) - Number(i.purchasePrice)) / Number(i.purchasePrice)) * 100
            : 0
        }))
        .sort((a, b) => b.potential - a.potential)
        .slice(0, 5);

      const technicianStats = repairs.reduce((acc: Record<string, { count: number; total: number }>, r) => {
        const id = r.technicianId || 'unknown';
        if (!acc[id]) acc[id] = { count: 0, total: 0 };
        acc[id].count++;
        acc[id].total += Number(r.repairCost);
        return acc;
      }, {});

      res.json({
        recommendedPrices,
        profitPotential,
        frequentFaults: (frequentFaults as any[]).slice(0, 5).map((f) => ({ fault: f.faultDescription, count: f._count.id })),
        technicianEfficiency: Object.entries(technicianStats).map(([id, s]) => ({ technicianId: id, repairs: s.count, revenue: s.total }))
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async priceOptimize(req: AuthRequest, res: Response) {
    try {
      const { brand, model, storage, condition, currentPrice, inventoryAgeDays } = req.query;
      if (!brand || !model || !currentPrice) return res.status(400).json({ error: 'brand, model, currentPrice required' });
      const result = await priceOptimizationAgent.optimize({
        brand: brand as string,
        model: model as string,
        storage: storage as string,
        condition: condition as string,
        currentPrice: Number(currentPrice),
        inventoryAgeDays: inventoryAgeDays ? Number(inventoryAgeDays) : undefined,
        companyId: req.user?.companyId,
        branchId: req.user?.branchId
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async businessIntelligence(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
    let branchId: string | null = null;
    try {
      branchId = await resolveEffectiveBranchId(req, companyId, req.query.branchId);

      const [purchaseRecs, inventoryRisks, repairPatterns, profitAnalysis, forecast, alerts] = await Promise.all([
        purchaseRecommendationAgent.getRecommendations({ companyId, limit: 10 }),
        inventoryRiskAgent.analyze({ companyId, branchId }),
        repairPatternAgent.analyze({ companyId }),
        profitAnalysisAgent.analyze({ companyId }),
        inventoryForecastAgent.forecast({ companyId, branchId }),
        aiAlertAgent.getAlerts({ companyId, limit: 15 })
      ]);

      const priceOpts = await Promise.all(
        (await prisma.inventory.findMany({ where: { companyId, ...(branchId ? { branchId } : {}), status: 'available' }, take: 5 })).map(async (inv) => {
          const days = Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (24 * 60 * 60 * 1000));
          const opt = await priceOptimizationAgent.optimize({
            brand: inv.brand,
            model: inv.model,
            storage: inv.storage,
            condition: inv.condition,
            currentPrice: Number(inv.sellingPrice),
            inventoryAgeDays: days,
            companyId,
            branchId
          });
          return { ...inv, optimization: opt };
        })
      );

      res.json({
        purchaseRecommendations: purchaseRecs,
        inventoryRiskAlerts: inventoryRisks,
        repairPatterns: repairPatterns.patterns,
        technicianEfficiency: repairPatterns.technicianEfficiency,
        profitAnalysis,
        inventoryForecast: forecast,
        aiAlerts: alerts,
        priceOptimizations: priceOpts
      });
    } catch (e: any) {
      logger.warn({ err: e }, '[ai] businessIntelligence degraded — returning empty payload');
      res.status(200).json({
        purchaseRecommendations: [],
        inventoryRiskAlerts: [],
        repairPatterns: [],
        technicianEfficiency: [],
        profitAnalysis: null,
        inventoryForecast: null,
        aiAlerts: [],
        priceOptimizations: [],
      });
    }
  },

  async getAlerts(req: AuthRequest, res: Response) {
    try {
      const alerts = await aiAlertAgent.getAlerts({ companyId: req.user?.companyId, limit: 20 });
      res.json(alerts);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async markAlertRead(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      await aiAlertAgent.markRead(req.params.id, companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async ask(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const userId = (req.user as any)?.userId;
      if (!companyId || !userId) return res.status(403).json({ error: 'Tenant context missing' });

      const question = String(req.body?.question || '').trim();
      if (!question) return res.status(400).json({ error: 'question is required' });

      const branchId = await resolveEffectiveBranchId(req, companyId, req.body?.branchId);
      const out = await aiService.askAI(companyId, userId, question, { branchId });
      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async businessEngine(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });
    let branchId: string | null = null;
    try {
      branchId = await resolveEffectiveBranchId(req, companyId, req.query?.branchId);
      const out = await aiBusinessEngineService.build({ companyId, branchId });
      res.json(out);
    } catch (e: any) {
      logger.warn({ err: e }, '[ai] businessEngine degraded — returning empty engine payload');
      try {
        branchId = await resolveEffectiveBranchId(req, companyId, req.query?.branchId);
      } catch {
        branchId = null;
      }
      res.json(emptyBusinessEngineResponse(companyId, branchId));
    }
  },

  // Focused business-decision endpoints (PowerBI + ops dashboards).
  async pricingSuggestions(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });
      const branchId = await resolveEffectiveBranchId(req, companyId, req.query?.branchId);
      const limit = Math.max(3, Math.min(25, Math.floor(Number(req.query?.limit || 10))));
      const ctx = await aiContextEngine.build({ companyId, branchId, days: 30 });
      const out = await smartPricingEngine.recommend({ companyId, branchId, ctx, limit });
      res.json({ companyId, branchId, generatedAt: ctx.generatedAt, pricing: out });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async highDemand(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });
      const branchId = await resolveEffectiveBranchId(req, companyId, req.query?.branchId);
      const days = Math.max(7, Math.min(120, Math.floor(Number(req.query?.days || 30))));
      const limit = Math.max(3, Math.min(50, Math.floor(Number(req.query?.limit || 10))));
      const ctx = await aiContextEngine.build({ companyId, branchId, days });
      res.json({
        companyId,
        branchId,
        generatedAt: ctx.generatedAt,
        days,
        topSelling: ctx.topSellingItems.slice(0, limit),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async lowStockRisks(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });
      const branchId = await resolveEffectiveBranchId(req, companyId, req.query?.branchId);
      const days = Math.max(7, Math.min(120, Math.floor(Number(req.query?.days || 30))));
      const ctx = await aiContextEngine.build({ companyId, branchId, days });
      res.json({
        companyId,
        branchId,
        generatedAt: ctx.generatedAt,
        lowStockModels: ctx.inventorySummary.lowStockModels,
        notes: ctx.inventorySummary.lowStockModels.length
          ? 'These models are below the low-stock heuristic threshold.'
          : 'No low-stock risks detected by heuristic threshold.',
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async simulate(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing' });
      const priceIncreasePct = Number(req.body?.priceIncreasePct ?? req.query?.priceIncreasePct ?? 0);
      const branchIdRaw = req.body?.branchId ?? req.query?.branchId;
      const branchId = await resolveEffectiveBranchId(req, companyId, branchIdRaw);
      const out = await aiSimulationService.simulatePriceChange({ companyId, branchId, priceIncreasePct });
      res.json(out);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};
