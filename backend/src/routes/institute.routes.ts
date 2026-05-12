import { Router } from 'express';
import { instituteController } from '../controllers/institute.controller';
import { validateBody, validateParams, validateQuery } from '../core/validation/zodMiddleware';
import { requirePermission } from '../middlewares/permission.middleware';
import {
  instituteBatchListQuerySchema,
  instituteCourseListQuerySchema,
  instituteCreateBatchBodySchema,
  instituteCreateCourseBodySchema,
  instituteCreateStudentBodySchema,
  instituteStudentIdParamSchema,
  instituteUpdateStudentBodySchema,
  instituteUpdateCourseBodySchema,
  instituteUpdateBatchBodySchema,
  instituteCourseIdParamSchema,
  instituteBatchIdParamSchema,
  instituteEnrollmentCreateBodySchema,
  instituteEnrollmentListQuerySchema,
  instituteFeeCreateBodySchema,
  instituteFeeListQuerySchema,
  institutePaymentCreateBodySchema,
  instituteStudentListQuerySchema,
  instituteAttendanceListQuerySchema,
  instituteAttendanceRecordBodySchema,
  instituteAttendanceBulkBodySchema,
  instituteAttendanceSummaryQuerySchema,
  instituteExamListQuerySchema,
  instituteExamIdParamSchema,
  instituteCreateExamBodySchema,
  instituteUpdateExamBodySchema,
  instituteResultListQuerySchema,
  instituteRecordResultBodySchema,
  instituteRecordResultBulkBodySchema,
  instituteStudentAcademicQuerySchema,
} from '../core/validation/schemas/institute.schemas';

const router = Router();

// ---------------- Students ----------------
router.get(
  '/students',
  requirePermission('institute.access'),
  validateQuery(instituteStudentListQuerySchema),
  instituteController.listStudents
);
router.post(
  '/students',
  requirePermission('institute.access'),
  validateBody(instituteCreateStudentBodySchema),
  instituteController.createStudent
);
router.get(
  '/students/:studentId',
  requirePermission('institute.access'),
  validateParams(instituteStudentIdParamSchema),
  instituteController.getStudent
);
router.patch(
  '/students/:studentId',
  requirePermission('institute.access'),
  validateParams(instituteStudentIdParamSchema),
  validateBody(instituteUpdateStudentBodySchema),
  instituteController.updateStudent
);

// ---------------- Courses ----------------
router.get(
  '/courses',
  requirePermission('institute.access'),
  validateQuery(instituteCourseListQuerySchema),
  instituteController.listCourses
);
router.post(
  '/courses',
  requirePermission('institute.access'),
  validateBody(instituteCreateCourseBodySchema),
  instituteController.createCourse
);
router.patch(
  '/courses/:courseId',
  requirePermission('institute.access'),
  validateParams(instituteCourseIdParamSchema),
  validateBody(instituteUpdateCourseBodySchema),
  instituteController.updateCourse
);

// ---------------- Batches ----------------
router.get(
  '/batches',
  requirePermission('institute.access'),
  validateQuery(instituteBatchListQuerySchema),
  instituteController.listBatches
);
router.post(
  '/batches',
  requirePermission('institute.access'),
  validateBody(instituteCreateBatchBodySchema),
  instituteController.createBatch
);
router.patch(
  '/batches/:batchId',
  requirePermission('institute.access'),
  validateParams(instituteBatchIdParamSchema),
  validateBody(instituteUpdateBatchBodySchema),
  instituteController.updateBatch
);

// ---------------- Enrollments ----------------
// Auto-generates fee charges when the batch (or its course) has a fee set,
// unless the caller passes an explicit `fees` array or `skipAutoFee: true`.
router.get(
  '/enrollments',
  requirePermission('institute.access'),
  validateQuery(instituteEnrollmentListQuerySchema),
  instituteController.listEnrollments
);
router.post(
  '/enrollments',
  requirePermission('institute.access'),
  validateBody(instituteEnrollmentCreateBodySchema),
  instituteController.createEnrollment
);

// ---------------- Fee charges (manual) ----------------
router.get(
  '/fees',
  requirePermission('institute.access'),
  validateQuery(instituteFeeListQuerySchema),
  instituteController.listFees
);
router.post(
  '/fees',
  requirePermission('institute.access'),
  validateBody(instituteFeeCreateBodySchema),
  instituteController.createFee
);

// ---------------- Attendance ----------------
router.get(
  '/attendance',
  requirePermission('institute.access'),
  validateQuery(instituteAttendanceListQuerySchema),
  instituteController.listAttendance
);
router.get(
  '/attendance/summary',
  requirePermission('institute.access'),
  validateQuery(instituteAttendanceSummaryQuerySchema),
  instituteController.attendanceSummary
);
router.post(
  '/attendance',
  requirePermission('institute.access'),
  validateBody(instituteAttendanceRecordBodySchema),
  instituteController.recordAttendance
);
router.post(
  '/attendance/bulk',
  requirePermission('institute.access'),
  validateBody(instituteAttendanceBulkBodySchema),
  instituteController.recordAttendanceBulk
);

// ---------------- Institute payments ----------------
// Writes a `Payment` row + transactionally updates the linked fee charge
// (paidAmount, balance, status, paidAt). Reuses the global Payment table
// rather than introducing a parallel ledger.
router.post(
  '/payments',
  requirePermission('institute.access'),
  validateBody(institutePaymentCreateBodySchema),
  instituteController.createPayment
);

// ---------------- Exams ----------------
router.get(
  '/exams',
  requirePermission('institute.access'),
  validateQuery(instituteExamListQuerySchema),
  instituteController.listExams
);
router.get(
  '/exams/:examId',
  requirePermission('institute.access'),
  validateParams(instituteExamIdParamSchema),
  instituteController.getExam
);
router.post(
  '/exams',
  requirePermission('institute.access'),
  validateBody(instituteCreateExamBodySchema),
  instituteController.createExam
);
router.patch(
  '/exams/:examId',
  requirePermission('institute.access'),
  validateParams(instituteExamIdParamSchema),
  validateBody(instituteUpdateExamBodySchema),
  instituteController.updateExam
);

// ---------------- Exam Results ----------------
router.get(
  '/results',
  requirePermission('institute.access'),
  validateQuery(instituteResultListQuerySchema),
  instituteController.listResults
);
router.post(
  '/results',
  requirePermission('institute.access'),
  validateBody(instituteRecordResultBodySchema),
  instituteController.recordResult
);
router.post(
  '/results/bulk',
  requirePermission('institute.access'),
  validateBody(instituteRecordResultBulkBodySchema),
  instituteController.recordResultBulk
);

// ---------------- Academic Summary ----------------
router.get(
  '/academic-summary',
  requirePermission('institute.access'),
  validateQuery(instituteStudentAcademicQuerySchema),
  instituteController.studentAcademicSummary
);

// ---------------- Transcript Data ----------------
router.get(
  '/transcript',
  requirePermission('institute.access'),
  validateQuery(instituteStudentAcademicQuerySchema),
  instituteController.transcriptData
);

export const instituteRoutes = router;
