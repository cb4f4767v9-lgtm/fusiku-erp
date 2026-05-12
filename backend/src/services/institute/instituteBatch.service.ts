import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export type InstituteBatchListQuery = {
  courseId?: string;
};

export const instituteBatchService = {
  async list(companyId: string, query: InstituteBatchListQuery = {}) {
    if (query.courseId) {
      const course = await prisma.instituteCourse.findFirst({
        where: { id: query.courseId, companyId },
        select: { id: true },
      });
      if (!course) {
        throw Object.assign(new Error('Course not found for this company'), { statusCode: 400 });
      }
    }

    return prisma.instituteBatch.findMany({
      where: {
        companyId,
        ...(query.courseId ? { courseId: query.courseId } : {}),
      },
      orderBy: [{ startsOn: 'desc' }, { updatedAt: 'desc' }],
      include: { course: { select: { id: true, title: true, code: true, defaultFee: true } } },
    });
  },

  async create(
    companyId: string,
    input: {
      courseId: string;
      name: string;
      startsOn?: Date;
      endsOn?: Date;
      feeOverride?: number;
      timingSlot?: string;
      timingLabel?: string;
      teacherName?: string;
      capacity?: number;
    }
  ) {
    const course = await prisma.instituteCourse.findFirst({
      where: { id: input.courseId, companyId },
      select: { id: true },
    });
    if (!course) {
      throw Object.assign(new Error('Course not found for this company'), { statusCode: 400 });
    }

    return prisma.instituteBatch.create({
      data: {
        companyId,
        courseId: input.courseId,
        name: input.name,
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        ...(input.feeOverride !== undefined ? { feeOverride: new Prisma.Decimal(input.feeOverride) } : {}),
        ...(input.timingSlot !== undefined ? { timingSlot: input.timingSlot } : {}),
        ...(input.timingLabel !== undefined ? { timingLabel: input.timingLabel } : {}),
        ...(input.teacherName !== undefined ? { teacherName: input.teacherName } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      },
      include: { course: { select: { id: true, title: true, code: true } } },
    });
  },

  async update(
    companyId: string,
    batchId: string,
    input: {
      name?: string;
      startsOn?: Date | null;
      endsOn?: Date | null;
      feeOverride?: number | null;
      timingSlot?: string | null;
      timingLabel?: string | null;
      teacherName?: string | null;
      capacity?: number | null;
    }
  ) {
    const existing = await prisma.instituteBatch.findFirst({
      where: { id: batchId, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw Object.assign(new Error('Batch not found'), { statusCode: 404 });
    }

    const data: Prisma.InstituteBatchUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.startsOn !== undefined) data.startsOn = input.startsOn;
    if (input.endsOn !== undefined) data.endsOn = input.endsOn;
    if (input.feeOverride === null) {
      data.feeOverride = null;
    } else if (input.feeOverride !== undefined) {
      data.feeOverride = new Prisma.Decimal(input.feeOverride);
    }
    if (input.timingSlot !== undefined) data.timingSlot = input.timingSlot;
    if (input.timingLabel !== undefined) data.timingLabel = input.timingLabel;
    if (input.teacherName !== undefined) data.teacherName = input.teacherName;
    if (input.capacity !== undefined) data.capacity = input.capacity;

    return prisma.instituteBatch.update({
      where: { id: batchId },
      data,
      include: { course: { select: { id: true, title: true, code: true, defaultFee: true } } },
    });
  },
};
