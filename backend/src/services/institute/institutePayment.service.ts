import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { resolveInstituteReceiptCurrency } from './instituteBranchCurrency';

/**
 * Institute payment allocation service.
 *
 * Records a `Payment` row and atomically applies it against a single
 * `InstituteFeeCharge`. All math is done in `Prisma.Decimal` so we never lose
 * precision when the legacy `Payment.amount: Float` is multiplied or
 * subtracted from a `Decimal(18, 4)` charge.
 *
 *   newPaidAmount = charge.paidAmount + payment.amount
 *   newBalance    = charge.amount     - newPaidAmount
 *   status        = 'paid'    if newBalance <= 0
 *                 | 'partial' if 0 < newPaidAmount < charge.amount
 *                 | 'pending' otherwise
 *
 * Overpayments are rejected with a 400 — split the payment yourself if a
 * customer hands you more than the outstanding balance. This keeps the
 * ledger honest.
 */

export type InstitutePaymentCreateInput = {
  feeChargeId: string;
  amount: number;
  currency?: string;
  method?: string;
  reference?: string;
  paidAt?: Date;
  branchId?: string;
};

function notFound(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function resolveStatus(
  newPaidAmount: Prisma.Decimal,
  amount: Prisma.Decimal
): 'pending' | 'partial' | 'paid' {
  if (newPaidAmount.gte(amount)) return 'paid';
  if (newPaidAmount.gt(0)) return 'partial';
  return 'pending';
}

export const institutePaymentService = {
  async record(companyId: string, input: InstitutePaymentCreateInput) {
    // 1. Optional branch must belong to the same tenant. Same defensive check
    //    we use for student creation.
    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, companyId },
        select: { id: true },
      });
      if (!branch) throw badRequest('Branch not found for this company');
    }

    const chargePreview = await prisma.instituteFeeCharge.findFirst({
      where: { id: input.feeChargeId, companyId },
      select: { studentId: true, currency: true },
    });
    if (!chargePreview) throw notFound('Fee charge not found for this company');

    const payerStudent = await prisma.instituteStudent.findFirst({
      where: { id: chargePreview.studentId, companyId },
      select: { branchId: true },
    });
    const receiptCurrencyFallback = await resolveInstituteReceiptCurrency(
      companyId,
      payerStudent?.branchId ?? null
    );

    // 2. Atomic allocation.
    return prisma.$transaction(async (tx) => {
      const charge = await tx.instituteFeeCharge.findFirst({
        where: { id: input.feeChargeId, companyId },
        select: {
          id: true,
          studentId: true,
          amount: true,
          paidAmount: true,
          balance: true,
          status: true,
          currency: true,
        },
      });
      if (!charge) throw notFound('Fee charge not found for this company');
      if (charge.status === 'paid' || charge.balance.lte(0)) {
        throw badRequest('Fee charge is already settled');
      }

      const paymentAmount = new Prisma.Decimal(input.amount);
      if (paymentAmount.lte(0)) {
        throw badRequest('Payment amount must be positive');
      }
      if (paymentAmount.gt(charge.balance)) {
        throw badRequest(
          `Payment amount exceeds outstanding balance (${charge.balance.toString()})`
        );
      }

      const newPaidAmount = charge.paidAmount.add(paymentAmount);
      const newBalance = charge.amount.sub(newPaidAmount);
      const newStatus = resolveStatus(newPaidAmount, charge.amount);
      const fullyPaid = newStatus === 'paid';
      const paidAt = input.paidAt ?? new Date();

      // 2a. Create the Payment row first so we have an id we can stash on
      //     the fee charge if downstream reporting wants it. Payment.amount
      //     stays a Float to match the rest of the codebase; we only store
      //     fees in Decimal.
      const payment = await tx.payment.create({
        data: {
          companyId,
          branchId: input.branchId ?? null,
          instituteFeeChargeId: charge.id,
          amount: input.amount,
          currency: (
            (input.currency && String(input.currency).trim()) ||
            (charge.currency && String(charge.currency).trim()) ||
            receiptCurrencyFallback
          ).toUpperCase(),
          method: input.method ?? 'cash',
          reference: input.reference ?? null,
          status: 'completed',
          paidAt,
        },
      });

      // 2b. Roll the fee charge forward.
      const updatedCharge = await tx.instituteFeeCharge.update({
        where: { id: charge.id },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
          paidAt: fullyPaid ? paidAt : null,
        },
      });

      return { payment, charge: updatedCharge };
    });
  },

  notFound,
  badRequest,
};
