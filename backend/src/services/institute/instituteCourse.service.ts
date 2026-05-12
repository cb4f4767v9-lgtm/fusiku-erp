import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export type InstituteCourseListQuery = {
  activeOnly?: boolean;
};

export const instituteCourseService = {
  async list(companyId: string, query: InstituteCourseListQuery = {}) {
    return prisma.instituteCourse.findMany({
      where: {
        companyId,
        ...(query.activeOnly === true ? { active: true } : {}),
      },
      orderBy: [{ active: 'desc' }, { title: 'asc' }],
      include: {
        _count: { select: { batches: true } },
      },
    });
  },

  async create(
    companyId: string,
    input: {
      title: string;
      code?: string;
      description?: string;
      active?: boolean;
      defaultFee?: number;
    }
  ) {
    return prisma.instituteCourse.create({
      data: {
        companyId,
        title: input.title,
        code: input.code,
        description: input.description,
        active: input.active ?? true,
        ...(input.defaultFee !== undefined
          ? { defaultFee: new Prisma.Decimal(input.defaultFee) }
          : {}),
      },
    });
  },

  async update(
    companyId: string,
    courseId: string,
    input: {
      title?: string;
      code?: string;
      description?: string;
      active?: boolean;
      defaultFee?: number | null;
    }
  ) {
    const existing = await prisma.instituteCourse.findFirst({
      where: { id: courseId, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw Object.assign(new Error('Course not found'), { statusCode: 404 });
    }

    const data: Prisma.InstituteCourseUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.code !== undefined) data.code = input.code;
    if (input.description !== undefined) data.description = input.description;
    if (input.active !== undefined) data.active = input.active;
    if (input.defaultFee === null) {
      data.defaultFee = null;
    } else if (input.defaultFee !== undefined) {
      data.defaultFee = new Prisma.Decimal(input.defaultFee);
    }

    return prisma.instituteCourse.update({
      where: { id: courseId },
      data,
    });
  },
};
