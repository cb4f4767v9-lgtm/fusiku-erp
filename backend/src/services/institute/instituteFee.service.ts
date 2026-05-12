import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { resolveInstituteFeeCurrency } from './instituteBranchCurrency';

/**
 * Tenant-scoped manual fee charge service.
 *
 * Most charges are auto-created by `instituteEnrollmentService.enrollStudent`;
 * this module covers the cases where the caller wants to issue an extra fee
 * by hand — late penalties, exam fees, ad-hoc materials charges, etc.
 *
 * Money is stored as `Decimal(18, 4)` for `amount`, `paidAmount`, and
 * `balance`. Callers send plain JS numbers (validated by Zod); we convert to
 * `Prisma.Decimal` before writing.
 */

export type InstituteFeeListQuery = {
  studentId?: string;
  enrollmentId?: string;
  status?: string;
  dueBefore?: Date;
};

export type InstituteFeeCreateInput = {
  studentId: string;
  enrollmentId?: string;
  label?: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
};

function notFound(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export const instituteFeeService = {
  async list(companyId: string, query: InstituteFeeListQuery = {}) {
    if (!companyId) {
      throw badRequest('Tenant context required (companyId)');
    }

    const where: Prisma.InstituteFeeChargeWhereInput = {
      companyId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dueBefore ? { dueDate: { lte: query.dueBefore } } : {}),
    };

    try {
      return await prisma.instituteFeeCharge.findMany({
        where,
        // `createdAt` is non-null and indexed; sorting on it first avoids
        // a slow plan when most rows have a null `dueDate`.
        orderBy: [{ createdAt: 'desc' }, { dueDate: 'asc' }],
        include: {
          student: {
            select: { id: true, fullName: true, studentCode: true },
          },
          enrollment: {
            select: {
              id: true,
              batch: {
                select: {
                  id: true,
                  name: true,
                  course: { select: { id: true, title: true, code: true } },
                },
              },
            },
          },
          /** Shown in fee ledger UIs (student profile, reconciliation). */
          payments: {
            select: {
              id: true,
              amount: true,
              currency: true,
              method: true,
              reference: true,
              paidAt: true,
              status: true,
            },
            orderBy: { paidAt: 'asc' },
          },
        },
      });
    } catch (err) {
      logger.error(
        { err, companyId, query },
        '[institute] listFees failed'
      );
      throw err;
    }
  },

  async create(companyId: string, input: InstituteFeeCreateInput) {
    // 1. Student must belong to this tenant.
    const student = await prisma.instituteStudent.findFirst({
      where: { id: input.studentId, companyId },
      select: { id: true, branchId: true },
    });
    if (!student) throw notFound('Student not found for this company');

    // 2. If an enrollment is supplied it must belong to this tenant AND match
    //    the same student. This prevents one tenant from bolting a fee onto
    //    another tenant's enrollment via a guessed cuid.
    if (input.enrollmentId) {
      const enrollment = await prisma.instituteEnrollment.findFirst({
        where: { id: input.enrollmentId, companyId },
        select: { id: true, studentId: true },
      });
      if (!enrollment) throw notFound('Enrollment not found for this company');
      if (enrollment.studentId !== input.studentId) {
        throw badRequest('Enrollment does not belong to the supplied student');
      }
    }

    const amount = new Prisma.Decimal(input.amount);
    const feeCurrency =
      (input.currency && input.currency.trim()) ||
      (await resolveInstituteFeeCurrency(companyId, student.branchId ?? null));

    return prisma.instituteFeeCharge.create({
      data: {
        companyId,
        studentId: input.studentId,
        enrollmentId: input.enrollmentId ?? null,
        label: input.label ?? null,
        amount,
        paidAmount: new Prisma.Decimal(0),
        balance: amount,
        currency: feeCurrency.toUpperCase(),
        dueDate: input.dueDate ?? null,
        status: 'pending',
      },
    });
  },

  async getById(companyId: string, id: string) {
    return prisma.instituteFeeCharge.findFirst({
      where: { id, companyId },
      include: {
        student: { select: { id: true, fullName: true, studentCode: true } },
        payments: true,
      },
    });
  },

  notFound,
  badRequest,
};
