import { z } from 'zod';

/** Invoice-linked payment (POST /invoices/:id/payments) — shared with invoice routes. */
export { invoicePaymentBodySchema as paymentOnInvoiceBodySchema } from './invoice.schemas';

export const expenseCreateBodySchema = z
  .object({
    branchId: z.string().min(1),
    category: z.string().optional(),
    amount: z.coerce.number(),
    expenseDate: z.union([z.string(), z.coerce.date()]).optional(),
    description: z.string().optional(),
    currency: z.string().optional(),
  })
  .passthrough();
