import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export type InstituteStudentListQuery = {
  status?: string;
  branchId?: string;
  q?: string;
};

export const instituteStudentService = {
  async list(companyId: string, query: InstituteStudentListQuery = {}) {
    const where: Prisma.InstituteStudentWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' } },
              { studentCode: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return prisma.instituteStudent.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async create(
    companyId: string,
    input: {
      fullName: string;
      studentCode?: string;
      email?: string;
      phone?: string;
      branchId?: string;
      status?: string;
    }
  ) {
    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: input.branchId, companyId },
        select: { id: true },
      });
      if (!branch) {
        throw Object.assign(new Error('Branch not found for this company'), { statusCode: 400 });
      }
    }

    return prisma.instituteStudent.create({
      data: {
        companyId,
        fullName: input.fullName,
        studentCode: input.studentCode,
        email: input.email,
        phone: input.phone,
        branchId: input.branchId,
        status: input.status ?? 'active',
      },
    });
  },
};
