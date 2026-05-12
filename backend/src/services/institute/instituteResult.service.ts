import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { calculateGrade, calculateWeightedGpa } from './instituteGrading';

export type ResultListQuery = {
  examId?: string;
  enrollmentId?: string;
};

export type BulkResultInput = {
  examId: string;
  results: {
    enrollmentId: string;
    obtainedMarks: number;
    remarks?: string;
    status?: 'pass' | 'fail' | 'absent' | 'withheld';
  }[];
};

export const instituteResultService = {
  async list(companyId: string, query: ResultListQuery = {}) {
    return prisma.instituteExamResult.findMany({
      where: {
        companyId,
        ...(query.examId ? { examId: query.examId } : {}),
        ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        exam: {
          select: { id: true, title: true, type: true, totalMarks: true, passingMarks: true, examDate: true, weightPercent: true },
        },
        enrollment: {
          select: {
            id: true,
            student: { select: { id: true, fullName: true, studentCode: true, profilePhotoUrl: true } },
          },
        },
      },
    });
  },

  async recordSingle(
    companyId: string,
    input: {
      examId: string;
      enrollmentId: string;
      obtainedMarks: number;
      remarks?: string;
      status?: 'pass' | 'fail' | 'absent' | 'withheld';
    }
  ) {
    const exam = await prisma.instituteExam.findFirst({
      where: { id: input.examId, companyId },
      select: { id: true, totalMarks: true, passingMarks: true, batchId: true },
    });
    if (!exam) throw Object.assign(new Error('Exam not found'), { statusCode: 404 });

    const enrollment = await prisma.instituteEnrollment.findFirst({
      where: { id: input.enrollmentId, companyId, batchId: exam.batchId },
      select: { id: true },
    });
    if (!enrollment) throw Object.assign(new Error('Enrollment not found for this batch'), { statusCode: 404 });

    if (input.obtainedMarks > exam.totalMarks) {
      throw Object.assign(new Error('Obtained marks cannot exceed total marks'), { statusCode: 400 });
    }

    const isAbsent = input.status === 'absent';
    const isWithheld = input.status === 'withheld';
    const marks = isAbsent ? 0 : input.obtainedMarks;

    const gradeResult = calculateGrade(marks, exam.totalMarks, exam.passingMarks);
    const finalStatus = isAbsent ? 'absent' : isWithheld ? 'withheld' : gradeResult.status;

    return prisma.instituteExamResult.upsert({
      where: {
        examId_enrollmentId: {
          examId: input.examId,
          enrollmentId: input.enrollmentId,
        },
      },
      update: {
        obtainedMarks: marks,
        percentage: new Prisma.Decimal(gradeResult.percentage),
        grade: gradeResult.grade,
        gpa: new Prisma.Decimal(gradeResult.gpa),
        status: finalStatus,
        remarks: input.remarks ?? null,
      },
      create: {
        companyId,
        examId: input.examId,
        enrollmentId: input.enrollmentId,
        obtainedMarks: marks,
        percentage: new Prisma.Decimal(gradeResult.percentage),
        grade: gradeResult.grade,
        gpa: new Prisma.Decimal(gradeResult.gpa),
        status: finalStatus,
        remarks: input.remarks ?? null,
      },
    });
  },

  async recordBulk(companyId: string, input: BulkResultInput) {
    const exam = await prisma.instituteExam.findFirst({
      where: { id: input.examId, companyId },
      select: { id: true, totalMarks: true, passingMarks: true, batchId: true },
    });
    if (!exam) throw Object.assign(new Error('Exam not found'), { statusCode: 404 });

    const enrollmentIds = input.results.map((r) => r.enrollmentId);
    const enrollments = await prisma.instituteEnrollment.findMany({
      where: { id: { in: enrollmentIds }, companyId, batchId: exam.batchId },
      select: { id: true },
    });
    const validIds = new Set(enrollments.map((e) => e.id));
    const invalid = enrollmentIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw Object.assign(new Error(`Invalid enrollment IDs: ${invalid.join(', ')}`), { statusCode: 400 });
    }

    const ops = input.results.map((r) => {
      const isAbsent = r.status === 'absent';
      const isWithheld = r.status === 'withheld';
      const marks = isAbsent ? 0 : Math.min(r.obtainedMarks, exam.totalMarks);
      const g = calculateGrade(marks, exam.totalMarks, exam.passingMarks);
      const finalStatus = isAbsent ? 'absent' : isWithheld ? 'withheld' : g.status;

      return prisma.instituteExamResult.upsert({
        where: {
          examId_enrollmentId: {
            examId: input.examId,
            enrollmentId: r.enrollmentId,
          },
        },
        update: {
          obtainedMarks: marks,
          percentage: new Prisma.Decimal(g.percentage),
          grade: g.grade,
          gpa: new Prisma.Decimal(g.gpa),
          status: finalStatus,
          remarks: r.remarks ?? null,
        },
        create: {
          companyId,
          examId: input.examId,
          enrollmentId: r.enrollmentId,
          obtainedMarks: marks,
          percentage: new Prisma.Decimal(g.percentage),
          grade: g.grade,
          gpa: new Prisma.Decimal(g.gpa),
          status: finalStatus,
          remarks: r.remarks ?? null,
        },
      });
    });

    return prisma.$transaction(ops);
  },

  /**
   * Transcript-ready data: full academic record for a student, structured
   * for future marksheet/transcript PDF generation. Each enrollment includes
   * course, batch, all exams with results, enrollment GPA, and overall GPA.
   */
  async transcriptData(companyId: string, studentId: string) {
    const student = await prisma.instituteStudent.findFirst({
      where: { id: studentId, companyId },
      select: {
        id: true, fullName: true, studentCode: true, dateOfBirth: true,
        gender: true, fatherName: true, profilePhotoUrl: true, createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
    if (!student) throw Object.assign(new Error('Student not found'), { statusCode: 404 });

    const enrollments = await prisma.instituteEnrollment.findMany({
      where: { companyId, studentId },
      select: {
        id: true, status: true, enrolledAt: true, admissionDate: true, expectedCompletionDate: true,
        batch: {
          select: {
            id: true, name: true, startsOn: true, endsOn: true,
            course: { select: { id: true, title: true, code: true } },
          },
        },
      },
    });

    const enrollmentIds = enrollments.map((e) => e.id);
    const results = await prisma.instituteExamResult.findMany({
      where: { companyId, enrollmentId: { in: enrollmentIds } },
      include: {
        exam: { select: { id: true, title: true, type: true, totalMarks: true, passingMarks: true, examDate: true, weightPercent: true } },
      },
      orderBy: [{ exam: { examDate: 'asc' } }],
    });

    const byEnrollment = new Map<string, typeof results>();
    for (const r of results) {
      const arr = byEnrollment.get(r.enrollmentId) ?? [];
      arr.push(r);
      byEnrollment.set(r.enrollmentId, arr);
    }

    const allGpaEntries: { gpa: number; weightPercent: number | null }[] = [];

    const enrollmentRecords = enrollments.map((e) => {
      const eResults = byEnrollment.get(e.id) ?? [];
      const gpaEntries = eResults
        .filter((r) => r.status === 'pass' || r.status === 'fail')
        .map((r) => ({ gpa: Number(r.gpa ?? 0), weightPercent: r.exam.weightPercent }));
      allGpaEntries.push(...gpaEntries);
      const enrollmentGpa = calculateWeightedGpa(gpaEntries);

      return {
        enrollmentId: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt,
        admissionDate: e.admissionDate,
        expectedCompletionDate: e.expectedCompletionDate,
        course: e.batch.course,
        batch: { id: e.batch.id, name: e.batch.name, startsOn: e.batch.startsOn, endsOn: e.batch.endsOn },
        gpa: enrollmentGpa,
        results: eResults.map((r) => ({
          examTitle: r.exam.title,
          examType: r.exam.type,
          examDate: r.exam.examDate,
          totalMarks: r.exam.totalMarks,
          passingMarks: r.exam.passingMarks,
          obtainedMarks: r.obtainedMarks,
          percentage: Number(r.percentage),
          grade: r.grade,
          gpa: r.gpa ? Number(r.gpa) : null,
          status: r.status,
          remarks: r.remarks,
        })),
      };
    });

    return {
      student,
      enrollments: enrollmentRecords,
      overallGpa: calculateWeightedGpa(allGpaEntries),
      generatedAt: new Date().toISOString(),
    };
  },

  /** GPA summary for a student across all exams in all enrollments. */
  async studentAcademicSummary(companyId: string, studentId: string) {
    const enrollments = await prisma.instituteEnrollment.findMany({
      where: { companyId, studentId },
      select: { id: true, batchId: true, batch: { select: { name: true, course: { select: { title: true } } } } },
    });

    if (enrollments.length === 0) return { enrollments: [], overallGpa: null };

    const enrollmentIds = enrollments.map((e) => e.id);

    const results = await prisma.instituteExamResult.findMany({
      where: { companyId, enrollmentId: { in: enrollmentIds } },
      select: {
        enrollmentId: true,
        obtainedMarks: true,
        percentage: true,
        grade: true,
        gpa: true,
        status: true,
        exam: { select: { id: true, title: true, type: true, totalMarks: true, passingMarks: true, weightPercent: true, examDate: true } },
      },
      orderBy: [{ exam: { examDate: 'desc' } }],
    });

    const byEnrollment = new Map<string, typeof results>();
    for (const r of results) {
      const arr = byEnrollment.get(r.enrollmentId) ?? [];
      arr.push(r);
      byEnrollment.set(r.enrollmentId, arr);
    }

    const allGpaEntries: { gpa: number; weightPercent: number | null }[] = [];

    const enrollmentSummaries = enrollments.map((e) => {
      const eResults = byEnrollment.get(e.id) ?? [];
      const gpaEntries = eResults
        .filter((r) => r.status === 'pass' || r.status === 'fail')
        .map((r) => ({
          gpa: Number(r.gpa ?? 0),
          weightPercent: r.exam.weightPercent,
        }));

      allGpaEntries.push(...gpaEntries);
      const enrollmentGpa = calculateWeightedGpa(gpaEntries);

      return {
        enrollmentId: e.id,
        batch: e.batch.name,
        course: e.batch.course.title,
        results: eResults,
        gpa: enrollmentGpa,
        totalExams: eResults.length,
        passed: eResults.filter((r) => r.status === 'pass').length,
        failed: eResults.filter((r) => r.status === 'fail').length,
      };
    });

    const overallGpa = calculateWeightedGpa(allGpaEntries);

    return { enrollments: enrollmentSummaries, overallGpa };
  },
};
