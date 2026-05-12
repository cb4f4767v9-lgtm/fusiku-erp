import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { stockAlertService } from '../services/stockAlert.service';

export const stockAlertController = {
  async getAlerts(req: AuthRequest, res: Response) {
    try {
      const alerts = await stockAlertService.getAlerts(req.user?.companyId);
      res.json(alerts);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async checkAlerts(req: AuthRequest, res: Response) {
    try {
      const alerts = await stockAlertService.checkAndCreateAlerts();
      const all = await stockAlertService.getAlerts(req.user?.companyId);
      res.json({ created: alerts.length, alerts: all });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async markRead(req: AuthRequest, res: Response) {
    try {
      await stockAlertService.markRead(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
