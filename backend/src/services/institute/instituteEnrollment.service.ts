import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { resolveInstituteFeeCurrency } from './instituteBranchCurrency';

/**
 * Tenant-scoped enrollment service.
 *
 * The flagship operation is `enrollStudent`, which:
 *
 *  1. Verifies the student and the batch both belong to the company.
 *  2. Resolves the auto-fee amount from `batch.feeOverride ?? course.defaultFee`
 *     unless the caller passes an explicit `fees` array (or `skipAutoFee`).
 *  3. Uses the student's branch institute fee currency (see `instituteBranchCurrency`)
 *     when no explicit currency is supplied on fee line items.
 *  4. Creates the enrollment and any auto-generated fee charges in one transaction.
 */

type FeeItemInput = {
  label?: string;
  amount: number;
  currency?: string;
  dueDate?: Date;
};

export type InstituteEnrollmentListQuery = {
  studentId?: string;
  batchId?: string;
  status?: string;
};

export type InstituteEnrollStudentInput = {
  studentId: string;
  batchId: string;
  status?: string;
  admissionDate?: Date;
  expectedCompletionDate?: Date;
  fees?: FeeItemInput[];
  skipAutoFee?: boolean;
};

function notFound(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value as number | string);
}

export const instituteEnrollmentService = {
  async list(companyId: string, query: InstituteEnrollmentListQuery = {}) {
    const where: Prisma.InstituteEnrollmentWhereInput = {
      companyId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    return prisma.instituteEnrollment.findMany({
      where,
      orderBy: [{ enrolledAt: 'desc' }],
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            studentCode: true,
            status: true,
            profilePhotoUrl: true,
            guardianName: true,
            guardianPhone: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            startsOn: true,
            endsOn: true,
            timingSlot: true,
            timingLabel: true,
            teacherName: true,
            capacity: true,
            course: { select: { id: true, title: true, code: true } },
          },
        },
        feeCharges: {
          select: {
            id: true,
            label: true,
            amount: true,
            paidAmount: true,
            balance: true,
            currency: true,
            dueDate: true,
            status: true,
          },
        },
      },
    });
  },

  async enrollStudent(
    companyId: string,
    input: InstituteEnrollStudentInput
  ): Promise<Prisma.InstituteEnrollmentGetPayload<{
    include: { feeCharges: true };
  }>> {
    const [student, batch] = await Promise.all([
      prisma.instituteStudent.findFirst({
        where: { id: input.studentId, companyId },
        select: { id: true, status: true, branchId: true },
      }),
      prisma.instituteBatch.findFirst({
        where: { id: input.batchId, companyId },
        select: {
          id: true,
          endsOn: true,
          feeOverride: true,
          course: { select: { defaultFee: true } },
        },
      }),
    ]);

    if (!student) throw notFound('Student not found for this company');
    if (!batch) throw notFound('Batch not found for this company');

    const feeCurrency = await resolveInstituteFeeCurrency(companyId, student.branchId ?? null);

    const explicitFees = (input.fees ?? []).filter((f) => f.amount > 0);
    const autoFee = batch.feeOverride ?? batch.course.defaultFee ?? null;

    const chargesToCreate: FeeItemInput[] = (() => {
      if (explicitFees.length > 0) return explicitFees;
      if (input.skipAutoFee) return [];
      if (!autoFee) return [];
      return [
        {
          label: 'Tuition',
          amount: Number(autoFee.toString()),
        },
      ];
    })();

    const admissionDate = input.admissionDate ?? new Date();
    const expectedCompletionDate = input.expectedCompletionDate ?? batch.endsOn ?? null;

    return prisma.$transaction(async (tx) => {
      const enrollment = await tx.instituteEnrollment.create({
        data: {
          companyId,
          studentId: input.studentId,
          batchId: input.batchId,
          status: input.status ?? 'active',
          admissionDate,
          expectedCompletionDate,
        },
      });

      if (chargesToCreate.length > 0) {
        await tx.instituteFeeCharge.createMany({
          data: chargesToCreate.map((f) => {
            const amount = toDecimal(f.amount);
            const cur = (f.currency ?? feeCurrency).toUpperCase();
            return {
              companyId,
              studentId: input.studentId,
              enrollmentId: enrollment.id,
              label: f.label ?? 'Tuition',
              amount,
              paidAmount: new Prisma.Decimal(0),
              balance: amount,
              currency: cur,
              dueDate: f.dueDate ?? null,
              status: 'pending',
            } satisfies Prisma.InstituteFeeChargeCreateManyInput;
          }),
        });
      }

      return tx.instituteEnrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
        include: { feeCharges: true },
      });
    });
  },

  async getById(companyId: string, id: string) {
    return prisma.instituteEnrollment.findFirst({
      where: { id, companyId },
      include: {
        feeCharges: true,
        student: { select: { id: true, fullName: true } },
        batch: { select: { id: true, name: true } },
      },
    });
  },
};
