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

export const aiController = {
  async deviceIdentify(req: AuthRequest, res: Response) {
    try {
      const result = await deviceIdentificationService.identify(req.params.imei);
      res.json(result || { brand: '', model: '', storage: '', color: '', source: null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async repairSuggestions(req: AuthRequest, res: Response) {
    try {
      const { model, fault } = req.query;
      if (!model || !fault) return res.status(400).json({ error: 'model and fault required' });
      const result = await repairAssistantService.getSuggestions(model as string, fault as string);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async priceEstimate(req: AuthRequest, res: Response) {
    try {
      const { brand, model, storage, condition, purchasePrice } = req.query;
      if (!brand || !model) return res.status(400).json({ error: 'brand and model required' });
      const result = await priceEstimatorService.estimate({
        brand: brand as string,
        model: model as string,
        storage: storage as string,
        condition: condition as string,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined
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
      const branchId = req.query.branchId as string;
      const where: any = branchId ? { branchId } : {};

      const [inventory, repairs, topProfit, frequentFaults] = await Promise.all([
        prisma.inventory.findMany({
          where: { ...where, status: 'available' },
          select: { brand: true, model: true, storage: true, condition: true, purchasePrice: true, sellingPrice: true }
        }),
        prisma.repair.findMany({
          where: { status: 'completed' },
          select: { faultDescription: true, repairCost: true, technicianId: true }
        }),
        prisma.inventory.findMany({
          where: { ...where, status: 'available' },
          select: { brand: true, model: true, sellingPrice: true, purchasePrice: true }
        }),
        prisma.repair.groupBy({
          by: ['faultDescription'],
          where: { status: 'completed' },
          _count: { id: true }
        })
      ]);

      const recommendedPrices = await Promise.all(
        inventory.slice(0, 5).map(async (inv) => {
          const est = await priceEstimatorService.estimate({
            brand: inv.brand,
            model: inv.model,
            storage: inv.storage,
            condition: inv.condition
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
    try {
      const branchId = req.query.branchId as string;
      const companyId = req.user?.companyId;

      const [purchaseRecs, inventoryRisks, repairPatterns, profitAnalysis, forecast, alerts] = await Promise.all([
        purchaseRecommendationAgent.getRecommendations({ companyId, limit: 10 }),
        inventoryRiskAgent.analyze({ companyId, branchId }),
        repairPatternAgent.analyze({ companyId }),
        profitAnalysisAgent.analyze({ companyId }),
        inventoryForecastAgent.forecast({ companyId, branchId }),
        aiAlertAgent.getAlerts({ companyId, limit: 15 })
      ]);

      const priceOpts = await Promise.all(
        (await prisma.inventory.findMany({ where: { status: 'available' }, take: 5 })).map(async (inv) => {
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
      res.status(500).json({ error: e.message });
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
  }
};
