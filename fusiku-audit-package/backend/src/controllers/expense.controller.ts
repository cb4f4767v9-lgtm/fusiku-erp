import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { assertBranchQueryAllowed } from '../utils/branchAccess';
import { expenseService } from '../services/expense.service';
import { logger } from '../utils/logger';

export const expenseController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const branchId = assertBranchQueryAllowed(req.user, req.query.branchId as string);
      const month = (req.query.month as string) || undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const rows = await expenseService.list({ branchId, month, startDate, endDate });
      res.json(rows);
    } catch (e: any) {
      const code = e.statusCode || 500;
      if (code === 403) return res.status(403).json({ error: e.message });
      logger.error({ err: e }, '[expense] list failed');
      res.status(500).json({ error: e.message || 'Failed to list expenses' });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const row = await expenseService.createFromHttpBody(req.user, (req.body || {}) as Record<string, unknown>);
      res.status(201).json(row);
    } catch (e: any) {
      const code = e.statusCode || 500;
      if (code === 400 || code === 403) return res.status(code).json({ error: e.message });
      logger.error({ err: e }, '[expense] create failed');
      res.status(500).json({ error: e.message || 'Failed to create expense' });
    }
  }
};
