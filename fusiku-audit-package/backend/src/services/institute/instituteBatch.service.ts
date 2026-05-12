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
      include: { course: { select: { id: true, title: true, code: true } } },
    });
  },

  async create(
    companyId: string,
    input: { courseId: string; name: string; startsOn?: Date; endsOn?: Date }
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
      },
      include: { course: { select: { id: true, title: true, code: true } } },
    });
  },
};
