import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { assertBranchQueryAllowed } from '../core/auth/branchGuard';
import { invoiceService } from '../services/invoice.service';
import type { z } from 'zod';
import { invoiceListQuerySchema } from '../core/validation/schemas/invoice.schemas';

type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export const invoiceController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const vq = (req as AuthRequest & { validatedQuery?: InvoiceListQuery }).validatedQuery;
      const branchId = assertBranchQueryAllowed(req.user, vq?.branchId ?? (req.query.branchId as string));
      const invoices = await invoiceService.list({
        branchId,
        status: (vq?.status ?? req.query.status) as string | undefined,
        q: (vq?.q ?? req.query.q) as string | undefined,
        take: vq?.take ?? (req.query.take != null ? Number(req.query.take) : undefined),
        skip: vq?.skip ?? (req.query.skip != null ? Number(req.query.skip) : undefined),
      });
      return res.json(invoices);
    } catch (e: any) {
      const code = e?.statusCode === 403 ? 403 : 400;
      return res.status(code).json({ success: false, message: e.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const id =
        (req as AuthRequest & { validatedParams?: { id: string } }).validatedParams?.id ?? req.params.id;
      const inv = await invoiceService.getById(id);
      if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
      return res.json({ success: true, data: inv });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },

  async createPayment(req: AuthRequest, res: Response) {
    try {
      const id =
        (req as AuthRequest & { validatedParams?: { id: string } }).validatedParams?.id ?? req.params.id;
      const out = await invoiceService.addPayment(id, req.body);
      return res.status(201).json({ success: true, data: out });
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message });
    }
  },
};

