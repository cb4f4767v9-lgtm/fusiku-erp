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
    });
  },

  async create(
    companyId: string,
    input: { title: string; code?: string; description?: string; active?: boolean }
  ) {
    return prisma.instituteCourse.create({
      data: {
        companyId,
        title: input.title,
        code: input.code,
        description: input.description,
        active: input.active ?? true,
      },
    });
  },
};
