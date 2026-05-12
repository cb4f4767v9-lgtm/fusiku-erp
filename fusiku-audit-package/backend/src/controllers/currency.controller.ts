import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { currencyService } from '../services/currency.service';
import { LEDGER_BASE_CURRENCY } from '../constants/ledgerCurrency';

export const currencyController = {
  /** Public contract: amounts & rates pivot on USD; does not change stored data. */
  async ledgerConfig(req: AuthRequest, res: Response) {
    try {
      res.json({
        ledgerBaseCurrency: LEDGER_BASE_CURRENCY,
        ratesPivotCurrency: LEDGER_BASE_CURRENCY,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const rows = await currencyService.list(companyId);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async rates(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const map = await currencyService.getRatesMap(companyId);
      res.json(map);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async refresh(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const { rows, source, message } = await currencyService.refreshLiveUsdBase(companyId);
      res.json({ rows, source, message: message || 'ok' });
    } catch (e: any) {
      // Never throw to UI: return last stored rows with fallback metadata.
      try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
        const rows = await currencyService.list(companyId);
        res.json({ rows, source: 'fallback', message: 'using_stored_rates' });
      } catch (inner: any) {
        res.status(200).json({ rows: [], source: 'fallback', message: 'using_stored_rates' });
      }
    }
  },

  async manualUpdate(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const { rows, source } = await currencyService.manualUpdateUsdBase(companyId, req.body);
      res.json({ rows, source });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });

      const code = String(req.params.code || '');
      const patch = req.body || {};
      const updated = await currencyService.updateCurrency(companyId, code, {
        marginPercent: patch.marginPercent,
        isAuto: patch.isAuto,
        manualRate: patch.manualRate,
      });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
  ,

  async quotes(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const supplierId = req.query.supplierId != null ? String(req.query.supplierId) : undefined;
      const rows = await currencyService.listQuotes(companyId, { supplierId });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async history(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Tenant context missing (companyId)' });
      const code = String(req.params.code || '');
      const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
      const rows = await currencyService.getHistory(companyId, code, limit);
      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
};

