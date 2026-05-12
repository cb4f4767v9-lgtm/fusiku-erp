import { prisma } from '../../utils/prisma';

export type AttendanceListQuery = {
  batchId?: string;
  enrollmentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type AttendanceRecordInput = {
  enrollmentId: string;
  batchId: string;
  date: Date;
  present: boolean;
  notes?: string;
};

export type AttendanceBulkInput = {
  batchId: string;
  date: Date;
  records: { enrollmentId: string; present: boolean; notes?: string }[];
};

export const instituteAttendanceService = {
  async list(companyId: string, query: AttendanceListQuery = {}) {
    return prisma.instituteAttendance.findMany({
      where: {
        companyId,
        ...(query.batchId ? { batchId: query.batchId } : {}),
        ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              date: {
                ...(query.dateFrom ? { gte: query.dateFrom } : {}),
                ...(query.dateTo ? { lte: query.dateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }],
      include: {
        enrollment: {
          select: {
            id: true,
            student: { select: { id: true, fullName: true, studentCode: true, profilePhotoUrl: true } },
          },
        },
      },
    });
  },

  async record(companyId: string, input: AttendanceRecordInput) {
    const enrollment = await prisma.instituteEnrollment.findFirst({
      where: { id: input.enrollmentId, companyId },
      select: { id: true, batchId: true },
    });
    if (!enrollment) {
      throw Object.assign(new Error('Enrollment not found'), { statusCode: 404 });
    }
    if (enrollment.batchId !== input.batchId) {
      throw Object.assign(new Error('Enrollment does not belong to specified batch'), { statusCode: 400 });
    }

    return prisma.instituteAttendance.upsert({
      where: {
        enrollmentId_date: {
          enrollmentId: input.enrollmentId,
          date: input.date,
        },
      },
      update: {
        present: input.present,
        notes: input.notes ?? null,
      },
      create: {
        companyId,
        batchId: input.batchId,
        enrollmentId: input.enrollmentId,
        date: input.date,
        present: input.present,
        notes: input.notes ?? null,
      },
    });
  },

  async recordBulk(companyId: string, input: AttendanceBulkInput) {
    const batch = await prisma.instituteBatch.findFirst({
      where: { id: input.batchId, companyId },
      select: { id: true },
    });
    if (!batch) {
      throw Object.assign(new Error('Batch not found'), { statusCode: 404 });
    }

    const enrollmentIds = input.records.map((r) => r.enrollmentId);
    const enrollments = await prisma.instituteEnrollment.findMany({
      where: { id: { in: enrollmentIds }, companyId, batchId: input.batchId },
      select: { id: true },
    });
    const validIds = new Set(enrollments.map((e) => e.id));

    const invalid = enrollmentIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw Object.assign(
        new Error(`Invalid enrollment IDs for this batch: ${invalid.join(', ')}`),
        { statusCode: 400 }
      );
    }

    const results = await prisma.$transaction(
      input.records.map((r) =>
        prisma.instituteAttendance.upsert({
          where: {
            enrollmentId_date: {
              enrollmentId: r.enrollmentId,
              date: input.date,
            },
          },
          update: {
            present: r.present,
            notes: r.notes ?? null,
          },
          create: {
            companyId,
            batchId: input.batchId,
            enrollmentId: r.enrollmentId,
            date: input.date,
            present: r.present,
            notes: r.notes ?? null,
          },
        })
      )
    );
    return results;
  },

  async summary(companyId: string, batchId: string) {
    const enrollments = await prisma.instituteEnrollment.findMany({
      where: { companyId, batchId, status: 'active' },
      select: {
        id: true,
        student: { select: { id: true, fullName: true, studentCode: true, profilePhotoUrl: true } },
      },
    });

    const attendanceRows = await prisma.instituteAttendance.findMany({
      where: { companyId, batchId },
      select: { enrollmentId: true, present: true },
    });

    const stats = new Map<string, { total: number; present: number }>();
    for (const a of attendanceRows) {
      const cur = stats.get(a.enrollmentId) ?? { total: 0, present: 0 };
      cur.total += 1;
      if (a.present) cur.present += 1;
      stats.set(a.enrollmentId, cur);
    }

    return enrollments.map((e) => {
      const s = stats.get(e.id) ?? { total: 0, present: 0 };
      const percentage = s.total > 0 ? Math.round((s.present / s.total) * 100) : null;
      return {
        enrollmentId: e.id,
        student: e.student,
        totalClasses: s.total,
        present: s.present,
        absent: s.total - s.present,
        percentage,
      };
    });
  },
};
