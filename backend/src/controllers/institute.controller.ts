import { Response } from 'express';
import type { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import {
  instituteBatchListQuerySchema,
  instituteCourseListQuerySchema,
  instituteEnrollmentListQuerySchema,
  instituteFeeListQuerySchema,
  instituteStudentListQuerySchema,
  instituteAttendanceListQuerySchema,
  instituteAttendanceSummaryQuerySchema,
  instituteExamListQuerySchema,
  instituteResultListQuerySchema,
  instituteStudentAcademicQuerySchema,
} from '../core/validation/schemas/institute.schemas';
import { instituteStudentService } from '../services/institute/instituteStudent.service';
import { instituteCourseService } from '../services/institute/instituteCourse.service';
import { instituteBatchService } from '../services/institute/instituteBatch.service';
import { instituteEnrollmentService } from '../services/institute/instituteEnrollment.service';
import { instituteFeeService } from '../services/institute/instituteFee.service';
import { institutePaymentService } from '../services/institute/institutePayment.service';
import { instituteAttendanceService } from '../services/institute/instituteAttendance.service';
import { instituteExamService } from '../services/institute/instituteExam.service';
import { instituteResultService } from '../services/institute/instituteResult.service';

type StudentListQuery = z.infer<typeof instituteStudentListQuerySchema>;
type CourseListQuery = z.infer<typeof instituteCourseListQuerySchema>;
type BatchListQuery = z.infer<typeof instituteBatchListQuerySchema>;
type EnrollmentListQuery = z.infer<typeof instituteEnrollmentListQuerySchema>;
type FeeListQuery = z.infer<typeof instituteFeeListQuerySchema>;
type AttendanceListQuery = z.infer<typeof instituteAttendanceListQuerySchema>;
type AttendanceSummaryQuery = z.infer<typeof instituteAttendanceSummaryQuerySchema>;
type ExamListQuery = z.infer<typeof instituteExamListQuerySchema>;
type ResultListQuery = z.infer<typeof instituteResultListQuerySchema>;
type AcademicQuery = z.infer<typeof instituteStudentAcademicQuerySchema>;

function requireCompany(req: AuthRequest, res: Response): string | null {
  const companyId = String(req.user?.companyId || '').trim();
  if (!companyId) {
    res.status(403).json({ error: 'Tenant context required (companyId)' });
    return null;
  }
  return companyId;
}

function prismaConflictMessage(e: unknown): string | null {
  const err = e as { code?: string; meta?: { target?: string[] } };
  if (err.code !== 'P2002') return null;
  const t = err.meta?.target;
  if (!Array.isArray(t)) return 'Duplicate record';
  if (t.includes('studentCode')) return 'Student code already exists for this company';
  if (t.includes('code')) return 'Course code already exists for this company';
  if (t.includes('studentId') && t.includes('batchId')) {
    return 'Student is already enrolled in this batch';
  }
  return 'Duplicate record';
}

/**
 * Centralised error → HTTP status mapper for the institute module. Services
 * tag domain errors with `statusCode` (400 for bad input, 404 for missing
 * tenant-scoped rows). Anything else is a 500.
 */
function handleServiceError(e: unknown, res: Response, fallback: string) {
  const dup = prismaConflictMessage(e);
  if (dup) return res.status(409).json({ error: dup });
  const err = e as { statusCode?: number; message?: string };
  if (err.statusCode === 400) return res.status(400).json({ error: err.message });
  if (err.statusCode === 404) return res.status(404).json({ error: err.message });

  // Surface the real reason in dev so the UI can show something useful instead
  // of the generic "request failed with status code 500"; redact in prod.
  const isProd = process.env.NODE_ENV === 'production';
  const detail = e instanceof Error ? e.message : '';
  logger.error({ err: e }, `[institute] ${fallback}`);
  return res.status(500).json({
    error: isProd ? fallback : detail || fallback,
  });
}

export const instituteController = {
  // ---------- Students ----------
  async listStudents(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: StudentListQuery }).validatedQuery;
      const rows = await instituteStudentService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list students');
    }
  },

  async createStudent(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteStudentService.create(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to create student');
    }
  },

  async getStudent(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vp = (req as AuthRequest & { validatedParams?: { studentId: string } }).validatedParams;
      const studentId = vp?.studentId || '';
      const row = await instituteStudentService.getById(companyId, studentId);
      if (!row) return res.status(404).json({ error: 'Student not found' });
      res.json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to load student');
    }
  },

  async updateStudent(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vp = (req as AuthRequest & { validatedParams?: { studentId: string } }).validatedParams;
      const studentId = vp?.studentId || '';
      const row = await instituteStudentService.update(companyId, studentId, req.body);
      res.json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to update student');
    }
  },

  // ---------- Courses ----------
  async listCourses(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: CourseListQuery }).validatedQuery;
      const rows = await instituteCourseService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list courses');
    }
  },

  async createCourse(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteCourseService.create(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to create course');
    }
  },

  // ---------- Batches ----------
  async listBatches(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: BatchListQuery }).validatedQuery;
      const rows = await instituteBatchService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list batches');
    }
  },

  async createBatch(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteBatchService.create(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to create batch');
    }
  },

  // ---------- Enrollments ----------
  async listEnrollments(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: EnrollmentListQuery }).validatedQuery;
      const rows = await instituteEnrollmentService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list enrollments');
    }
  },

  async createEnrollment(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteEnrollmentService.enrollStudent(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to enroll student');
    }
  },

  // ---------- Fee charges ----------
  async listFees(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: FeeListQuery }).validatedQuery;
      const rows = await instituteFeeService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list fee charges');
    }
  },

  async createFee(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteFeeService.create(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to create fee charge');
    }
  },

  // ---------- Course PATCH ----------
  async updateCourse(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vp = (req as AuthRequest & { validatedParams?: { courseId: string } }).validatedParams;
      const courseId = vp?.courseId || '';
      const row = await instituteCourseService.update(companyId, courseId, req.body);
      res.json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to update course');
    }
  },

  // ---------- Batch PATCH ----------
  async updateBatch(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vp = (req as AuthRequest & { validatedParams?: { batchId: string } }).validatedParams;
      const batchId = vp?.batchId || '';
      const row = await instituteBatchService.update(companyId, batchId, req.body);
      res.json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to update batch');
    }
  },

  // ---------- Attendance ----------
  async listAttendance(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: AttendanceListQuery }).validatedQuery;
      const rows = await instituteAttendanceService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list attendance');
    }
  },

  async recordAttendance(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteAttendanceService.record(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to record attendance');
    }
  },

  async recordAttendanceBulk(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const rows = await instituteAttendanceService.recordBulk(companyId, req.body);
      res.status(201).json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to record bulk attendance');
    }
  },

  async attendanceSummary(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: AttendanceSummaryQuery }).validatedQuery;
      if (!vq?.batchId) return res.status(400).json({ error: 'batchId is required' });
      const rows = await instituteAttendanceService.summary(companyId, vq.batchId);
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to load attendance summary');
    }
  },

  // ---------- Institute payments ----------
  async createPayment(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await institutePaymentService.record(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to record payment');
    }
  },

  // ---------- Exams ----------
  async listExams(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: ExamListQuery }).validatedQuery ?? {};
      const rows = await instituteExamService.list(companyId, vq);
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list exams');
    }
  },

  async getExam(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const { examId } = (req as AuthRequest & { validatedParams?: { examId: string } }).validatedParams!;
      const exam = await instituteExamService.getById(companyId, examId);
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      res.json(exam);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to load exam');
    }
  },

  async createExam(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const exam = await instituteExamService.create(companyId, req.body);
      res.status(201).json(exam);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to create exam');
    }
  },

  async updateExam(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const { examId } = (req as AuthRequest & { validatedParams?: { examId: string } }).validatedParams!;
      const exam = await instituteExamService.update(companyId, examId, req.body);
      res.json(exam);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to update exam');
    }
  },

  // ---------- Results ----------
  async listResults(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: ResultListQuery }).validatedQuery ?? {};
      const rows = await instituteResultService.list(companyId, vq);
      res.json(rows);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to list results');
    }
  },

  async recordResult(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const result = await instituteResultService.recordSingle(companyId, req.body);
      res.status(201).json(result);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to record result');
    }
  },

  async recordResultBulk(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const results = await instituteResultService.recordBulk(companyId, req.body);
      res.status(201).json(results);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to record bulk results');
    }
  },

  async studentAcademicSummary(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: AcademicQuery }).validatedQuery;
      if (!vq?.studentId) return res.status(400).json({ error: 'studentId is required' });
      const summary = await instituteResultService.studentAcademicSummary(companyId, vq.studentId);
      res.json(summary);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to load academic summary');
    }
  },

  async transcriptData(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: AcademicQuery }).validatedQuery;
      if (!vq?.studentId) return res.status(400).json({ error: 'studentId is required' });
      const data = await instituteResultService.transcriptData(companyId, vq.studentId);
      res.json(data);
    } catch (e: unknown) {
      handleServiceError(e, res, 'Failed to load transcript data');
    }
  },
};
