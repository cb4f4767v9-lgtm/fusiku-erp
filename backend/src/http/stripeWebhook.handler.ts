import type { Request, Response } from 'express';
import { stripeBillingService } from '../services/stripeBilling.service';

export async function stripeWebhookHandler(req: Request, res: Response) {
  try {
    const rawBody = req.body as Buffer;
    const sig = req.headers['stripe-signature'];
    await stripeBillingService.handleWebhook(rawBody, sig);
    res.json({ received: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Webhook error' });
  }
}

