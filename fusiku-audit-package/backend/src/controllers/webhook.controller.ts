/**
 * Webhook management controller
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { webhookService } from '../services/webhook.service';
import type { WebhookEvent } from '../services/webhook.service';

const VALID_EVENTS: WebhookEvent[] = ['sale.completed', 'repair.completed', 'inventory.updated', 'low_stock.alert'];

export const webhookController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      const { url, eventType } = req.body;
      if (!url || !eventType) return res.status(400).json({ error: 'url and eventType required' });
      if (!VALID_EVENTS.includes(eventType)) {
        return res.status(400).json({ error: `eventType must be one of: ${VALID_EVENTS.join(', ')}` });
      }
      const webhook = await webhookService.create(companyId, url, eventType);
      res.status(201).json({ id: webhook.id, url: webhook.url, eventType: webhook.eventType });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      const webhooks = await webhookService.list(companyId);
      res.json(webhooks);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      await webhookService.delete(req.params.id, companyId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
