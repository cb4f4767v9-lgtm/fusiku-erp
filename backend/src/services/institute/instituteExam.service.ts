import { prisma } from '../../utils/prisma';

export type ExamListQuery = {
  batchId?: string;
  type?: string;
};

export const instituteExamService = {
  async list(companyId: string, query: ExamListQuery = {}) {
    return prisma.instituteExam.findMany({
      where: {
        companyId,
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: [{ examDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, title: true, code: true } },
          },
        },
        _count: { select: { results: true } },
      },
    });
  },

  async getById(companyId: string, examId: string) {
    return prisma.instituteExam.findFirst({
      where: { id: examId, companyId },
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, title: true, code: true } },
          },
        },
        results: {
          include: {
            enrollment: {
              select: {
                id: true,
                student: {
                  select: { id: true, fullName: true, studentCode: true, profilePhotoUrl: true },
                },
              },
            },
          },
          orderBy: { obtainedMarks: 'desc' },
        },
      },
    });
  },

  async create(
    companyId: string,
    input: {
      batchId: string;
      branchId?: string;
      title: string;
      type?: string;
      totalMarks: number;
      passingMarks: number;
      examDate?: Date;
      weightPercent?: number;
      remarks?: string;
    }
  ) {
    const batch = await prisma.instituteBatch.findFirst({
      where: { id: input.batchId, companyId },
      select: { id: true },
    });
    if (!batch) {
      throw Object.assign(new Error('Batch not found'), { statusCode: 404 });
    }

    if (input.passingMarks > input.totalMarks) {
      throw Object.assign(new Error('Passing marks cannot exceed total marks'), { statusCode: 400 });
    }

    return prisma.instituteExam.create({
      data: {
        companyId,
        batchId: input.batchId,
        branchId: input.branchId ?? null,
        title: input.title,
        type: input.type ?? 'quiz',
        totalMarks: input.totalMarks,
        passingMarks: input.passingMarks,
        examDate: input.examDate ?? null,
        weightPercent: input.weightPercent ?? null,
        remarks: input.remarks ?? null,
      },
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, title: true, code: true } },
          },
        },
      },
    });
  },

  async update(
    companyId: string,
    examId: string,
    input: {
      title?: string;
      type?: string;
      totalMarks?: number;
      passingMarks?: number;
      examDate?: Date | null;
      weightPercent?: number | null;
      remarks?: string | null;
    }
  ) {
    const existing = await prisma.instituteExam.findFirst({
      where: { id: examId, companyId },
      select: { id: true, totalMarks: true },
    });
    if (!existing) {
      throw Object.assign(new Error('Exam not found'), { statusCode: 404 });
    }

    const totalMarks = input.totalMarks ?? existing.totalMarks;
    if (input.passingMarks !== undefined && input.passingMarks > totalMarks) {
      throw Object.assign(new Error('Passing marks cannot exceed total marks'), { statusCode: 400 });
    }

    return prisma.instituteExam.update({
      where: { id: examId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.totalMarks !== undefined ? { totalMarks: input.totalMarks } : {}),
        ...(input.passingMarks !== undefined ? { passingMarks: input.passingMarks } : {}),
        ...(input.examDate !== undefined ? { examDate: input.examDate } : {}),
        ...(input.weightPercent !== undefined ? { weightPercent: input.weightPercent } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
      },
    });
  },
};
