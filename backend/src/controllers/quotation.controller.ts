import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { quotationService } from '../services/quotation.service';
import type { QuotationGenerateBody } from '../core/validation/schemas/quotation.schemas';

export const quotationController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const vq = (req as any).validatedQuery as { q?: string; take?: number; skip?: number } | undefined;
      const out = await quotationService.list({ q: vq?.q, take: vq?.take, skip: vq?.skip });
      return res.json(out);
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const id = (req as any).validatedParams?.id ?? req.params.id;
      const out = await quotationService.getById(id);
      if (!out) return res.status(404).json({ success: false, message: 'Quotation not found' });
      return res.json({ success: true, data: out });
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  /** POST /quotations/generate — auto-price and persist. */
  async generate(req: AuthRequest, res: Response) {
    try {
      const body = req.body as QuotationGenerateBody;
      const out = await quotationService.generate(body, { createdById: req.user?.id ?? null });
      return res.status(201).json({ success: true, data: out });
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const id = (req as any).validatedParams?.id ?? req.params.id;
      const out = await quotationService.remove(id);
      return res.json(out);
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },

  /** GET /quotations/:id/share?currency=AED — returns plain-text + WhatsApp deep link. */
  async share(req: AuthRequest, res: Response) {
    try {
      const id = (req as any).validatedParams?.id ?? req.params.id;
      const quotation = await quotationService.getById(id);
      if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

      const currency = String(req.query.currency || 'AED').trim().toUpperCase();
      const text = quotationService.buildShareText(quotation, { currency });

      const phone = String(quotation.customerPhone || '').replace(/\D+/g, '');
      const encoded = encodeURIComponent(text);
      const whatsappUrl = phone
        ? `https://wa.me/${phone}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;

      return res.json({ success: true, data: { text, whatsappUrl, currency, phone: phone || null } });
    } catch (e: any) {
      return res.status(e?.statusCode ?? 400).json({ success: false, message: e.message });
    }
  },
};
