/**
 * Webhook dispatch service
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { prisma } from '../utils/prisma';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { integrationLogService } from './integrationLog.service';

export type WebhookEvent = 'sale.completed' | 'repair.completed' | 'inventory.updated' | 'low_stock.alert';

export const webhookService = {
  async dispatch(companyId: string, eventType: WebhookEvent, payload: object) {
    const webhooks = await prisma.webhook.findMany({
      where: { companyId, eventType, isActive: true }
    });
    for (const wh of webhooks) {
      this.sendWebhook(companyId, wh, payload).catch((err) => {
        logger.warn({ webhookId: wh.id, eventType, err }, 'Webhook delivery failed');
      });
    }
  },

  async sendWebhook(companyId: string, webhook: { id: string; url: string; secret: string; eventType: string }, payload: object) {
    const body = JSON.stringify({
      event: webhook.eventType,
      timestamp: new Date().toISOString(),
      data: payload
    });
    const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': webhook.eventType
      },
      body
    });
    await integrationLogService.log({
      companyId,
      integrationType: 'webhook',
      requestPayload: { webhookId: webhook.id, event: webhook.eventType },
      responseStatus: res.status,
      responseBody: (await res.text().catch(() => '')).slice(0, 500),
      errorMessage: !res.ok ? `HTTP ${res.status}` : undefined
    });
  },

  async create(companyId: string, url: string, eventType: WebhookEvent) {
    const secret = crypto.randomBytes(24).toString('hex');
    return prisma.webhook.create({
      data: { companyId, url, eventType, secret }
    });
  },

  async list(companyId: string) {
    return prisma.webhook.findMany({
      where: { companyId },
      select: { id: true, url: true, eventType: true, isActive: true, createdAt: true }
    });
  },

  async delete(id: string, companyId: string) {
    return prisma.webhook.deleteMany({ where: { id, companyId } });
  }
};
