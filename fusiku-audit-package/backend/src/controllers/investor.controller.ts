import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { investorService } from '../services/investor.service';
import { logger } from '../utils/logger';

export const investorController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const activeOnly = String(req.query.activeOnly || '') === '1' || String(req.query.activeOnly || '') === 'true';
      const rows = await investorService.list(activeOnly);
      res.json(rows);
    } catch (e: any) {
      logger.error({ err: e }, '[investor] list failed');
      res.status(500).json({ error: e.message || 'Failed to list investors' });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const row = await investorService.getById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (e: any) {
      logger.error({ err: e }, '[investor] get failed');
      res.status(500).json({ error: e.message || 'Failed to load investor' });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const row = await investorService.createFromHttpBody((req.body || {}) as Record<string, unknown>);
      res.status(201).json(row);
    } catch (e: any) {
      const code = e.statusCode || (e.message?.includes('must') ? 400 : 500);
      res.status(code).json({ error: e.message || 'Failed to create investor' });
    }
  },

  async addTransaction(req: AuthRequest, res: Response) {
    try {
      const row = await investorService.addTransactionFromHttpBody(
        req.params.id,
        (req.body || {}) as Record<string, unknown>
      );
      res.status(201).json(row);
    } catch (e: any) {
      const code = e.statusCode || (e.message?.includes('must') || e.message?.includes('positive') ? 400 : 500);
      res.status(code).json({ error: e.message || 'Failed to record transaction' });
    }
  },

  async listTransactions(req: AuthRequest, res: Response) {
    try {
      const rows = await investorService.listTransactions(req.params.id);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to list transactions' });
    }
  },

  async capitalSummary(req: AuthRequest, res: Response) {
    try {
      const q = req.query.netProfitUsd;
      const netProfitUsd = q != null && String(q).trim() !== '' ? Number(q) : undefined;
      const summary = await investorService.getCapitalSummary(
        netProfitUsd != null && Number.isFinite(netProfitUsd) ? { netProfitUsd } : {}
      );
      res.json(summary);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to build capital summary' });
    }
  }
  ,

  async financialReport(req: AuthRequest, res: Response) {
    try {
      const period = req.query.period != null ? String(req.query.period) : undefined;
      const q = req.query.netProfitUsd;
      const netProfitUsd = q != null && String(q).trim() !== '' ? Number(q) : undefined;
      const report = await investorService.getFinancialReport({
        period,
        netProfitUsd: netProfitUsd != null && Number.isFinite(netProfitUsd) ? netProfitUsd : undefined
      });
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to build investor financial report' });
    }
  },

  async listProfitDistributions(req: AuthRequest, res: Response) {
    try {
      const period = req.query.period != null ? String(req.query.period) : undefined;
      const rows = await investorService.listProfitDistributions(req.params.id, { period });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to list profit distributions' });
    }
  },

  async addProfitDistribution(req: AuthRequest, res: Response) {
    try {
      const row = await investorService.addProfitDistributionFromHttpBody(
        req.params.id,
        (req.body || {}) as Record<string, unknown>
      );
      res.status(201).json(row);
    } catch (e: any) {
      const code = e.statusCode || (e.message?.includes('required') || e.message?.includes('positive') ? 400 : 500);
      res.status(code).json({ error: e.message || 'Failed to record profit distribution' });
    }
  }
};
