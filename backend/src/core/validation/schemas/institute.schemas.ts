import { z } from 'zod';

function emptyToUndefined(val: unknown) {
  if (val === '' || val === undefined || val === null) return undefined;
  return val;
}

export const instituteStudentListQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  branchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});

/** Shared optional profile fields (create accepts all as optional beyond fullName). */
const instituteStudentProfileFieldsSchema = z.object({
  gender: z.preprocess(emptyToUndefined, z.string().trim().max(32).optional()),
  dateOfBirth: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  profilePhotoUrl: z.preprocess(emptyToUndefined, z.string().trim().max(2048).optional()),
  nationalId: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  bloodGroup: z.preprocess(emptyToUndefined, z.string().trim().max(16).optional()),
  whatsApp: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  addressLine: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  country: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  fatherName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  motherName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  guardianName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  emergencyContact: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  guardianPhone: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  previousSchool: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
  qualification: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(10000).optional()),
  identityDocumentType: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  identityDocumentNumber: z.preprocess(emptyToUndefined, z.string().trim().max(128).optional()),
});

export const instituteStudentIdParamSchema = z.object({
  studentId: z.string().cuid(),
});

export const instituteCreateStudentBodySchema = z
  .object({
    fullName: z.string().trim().min(1).max(500),
    studentCode: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(128).optional()),
    email: z.preprocess(emptyToUndefined, z.string().trim().email().max(320).optional()),
    phone: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
    branchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
    status: z.string().trim().max(64).optional().default('active'),
  })
  .merge(instituteStudentProfileFieldsSchema);

/** PATCH — all fields optional; omit keys that should not change. */
export const instituteUpdateStudentBodySchema = z
  .object({
    fullName: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(500).optional()),
    studentCode: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(128).optional()),
    email: z.preprocess(emptyToUndefined, z.string().trim().email().max(320).optional()),
    phone: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
    branchId: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.union([z.string().cuid(), z.null()]).optional()
    ),
    status: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  })
  .merge(instituteStudentProfileFieldsSchema)
  .strict();

export const instituteCourseListQuerySchema = z.object({
  activeOnly: z.preprocess((v) => {
    if (v === undefined || v === '') return undefined;
    if (v === true || v === 'true' || v === '1' || v === 1) return true;
    if (v === false || v === 'false' || v === '0' || v === 0) return false;
    return undefined;
  }, z.boolean().optional()),
});

export const instituteCreateCourseBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  code: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(128).optional()),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(20000).optional()),
  active: z.boolean().optional().default(true),
});

export const instituteBatchListQuerySchema = z.object({
  courseId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
});

export const instituteCreateBatchBodySchema = z.object({
  courseId: z.string().cuid(),
  name: z.string().trim().min(1).max(500),
  startsOn: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endsOn: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  feeOverride: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative().max(1_000_000_000).optional()
  ),
  timingSlot: z.preprocess(emptyToUndefined, z.string().trim().max(32).optional()),
  timingLabel: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  teacherName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  capacity: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(100000).optional()),
});

export const instituteUpdateCourseBodySchema = z.object({
  title: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(500).optional()),
  code: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(128).optional()),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(20000).optional()),
  active: z.boolean().optional(),
  defaultFee: z.preprocess(
    (v) => (v === '' || v === null ? null : v === undefined ? undefined : v),
    z.union([z.coerce.number().nonnegative().max(1_000_000_000), z.null()]).optional()
  ),
}).strict();

export const instituteUpdateBatchBodySchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(500).optional()),
  startsOn: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endsOn: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  feeOverride: z.preprocess(
    (v) => (v === '' || v === null ? null : v === undefined ? undefined : v),
    z.union([z.coerce.number().nonnegative().max(1_000_000_000), z.null()]).optional()
  ),
  timingSlot: z.preprocess(emptyToUndefined, z.string().trim().max(32).optional()),
  timingLabel: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  teacherName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  capacity: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(100000).optional()),
}).strict();

export const instituteCourseIdParamSchema = z.object({
  courseId: z.string().cuid(),
});

export const instituteBatchIdParamSchema = z.object({
  batchId: z.string().cuid(),
});

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export const instituteAttendanceListQuerySchema = z.object({
  batchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  enrollmentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  dateFrom: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  dateTo: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export const instituteAttendanceRecordBodySchema = z.object({
  enrollmentId: z.string().cuid(),
  batchId: z.string().cuid(),
  date: z.coerce.date(),
  present: z.boolean(),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

export const instituteAttendanceBulkBodySchema = z.object({
  batchId: z.string().cuid(),
  date: z.coerce.date(),
  records: z.array(z.object({
    enrollmentId: z.string().cuid(),
    present: z.boolean(),
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  })).min(1).max(500),
});

export const instituteAttendanceSummaryQuerySchema = z.object({
  batchId: z.string().cuid(),
});

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

/**
 * Optional per-charge override the caller can pass when enrolling. If no
 * `fees` array is provided, the service falls back to
 * `batch.feeOverride ?? course.defaultFee` and, if that is also null, creates
 * no charges at all (a free / sponsored enrollment).
 */
export const instituteEnrollmentFeeItemSchema = z.object({
  label: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.preprocess(
    emptyToUndefined,
    z.string().trim().length(3).toUpperCase().optional()
  ),
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export const instituteEnrollmentListQuerySchema = z.object({
  studentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  batchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  status: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
});

export const instituteEnrollmentCreateBodySchema = z.object({
  studentId: z.string().cuid(),
  batchId: z.string().cuid(),
  status: z.string().trim().max(64).optional().default('active'),
  admissionDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  expectedCompletionDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  /** Optional explicit fee schedule — when omitted, auto-derive from course/batch. */
  fees: z.array(instituteEnrollmentFeeItemSchema).max(50).optional(),
  /**
   * When true and no `fees` are supplied, skip auto fee generation entirely
   * (useful for sponsored students). Defaults to false so the common case
   * "enroll + auto-bill" stays a single call.
   */
  skipAutoFee: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Fee charges
// ---------------------------------------------------------------------------

export const instituteFeeListQuerySchema = z.object({
  studentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  enrollmentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  status: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  /** Filter to charges with `dueDate <= dueBefore`. ISO date string. */
  dueBefore: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export const instituteFeeCreateBodySchema = z
  .object({
    studentId: z.string().cuid(),
    enrollmentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
    label: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
    amount: z.coerce.number().positive().max(1_000_000_000),
    currency: z.preprocess(
      emptyToUndefined,
      z.string().trim().length(3).toUpperCase().optional()
    ),
    dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  })
  .strict();

// ---------------------------------------------------------------------------
// Institute payments (Payment row + fee allocation)
// ---------------------------------------------------------------------------

export const institutePaymentCreateBodySchema = z
  .object({
    feeChargeId: z.string().cuid(),
    amount: z.coerce.number().positive().max(1_000_000_000),
    currency: z.preprocess(
      emptyToUndefined,
      z.string().trim().length(3).toUpperCase().optional()
    ),
    method: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(64).optional()
    ),
    reference: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(500).optional()
    ),
    paidAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    branchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  })
  .strict();

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

const examTypes = ['quiz', 'assignment', 'practical', 'viva', 'midterm', 'final'] as const;

export const instituteExamListQuerySchema = z.object({
  batchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  type: z.preprocess(emptyToUndefined, z.enum(examTypes).optional()),
});

export const instituteExamIdParamSchema = z.object({
  examId: z.string().cuid(),
});

export const instituteCreateExamBodySchema = z.object({
  batchId: z.string().cuid(),
  branchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  title: z.string().trim().min(1).max(500),
  type: z.enum(examTypes).optional().default('quiz'),
  totalMarks: z.coerce.number().int().positive().max(10000),
  passingMarks: z.coerce.number().int().nonnegative().max(10000),
  examDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  weightPercent: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100).optional()),
  remarks: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
});

export const instituteUpdateExamBodySchema = z.object({
  title: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(500).optional()),
  type: z.enum(examTypes).optional(),
  totalMarks: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(10000).optional()),
  passingMarks: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(10000).optional()),
  examDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  weightPercent: z.preprocess(
    (v) => (v === '' || v === null ? null : v === undefined ? undefined : v),
    z.union([z.coerce.number().int().min(0).max(100), z.null()]).optional()
  ),
  remarks: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
}).strict();

// ---------------------------------------------------------------------------
// Exam Results
// ---------------------------------------------------------------------------

const resultStatuses = ['pass', 'fail', 'absent', 'withheld'] as const;

export const instituteResultListQuerySchema = z.object({
  examId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  enrollmentId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
});

export const instituteRecordResultBodySchema = z.object({
  examId: z.string().cuid(),
  enrollmentId: z.string().cuid(),
  obtainedMarks: z.coerce.number().int().nonnegative().max(10000),
  remarks: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
  status: z.enum(resultStatuses).optional(),
});

export const instituteRecordResultBulkBodySchema = z.object({
  examId: z.string().cuid(),
  results: z.array(z.object({
    enrollmentId: z.string().cuid(),
    obtainedMarks: z.coerce.number().int().nonnegative().max(10000),
    remarks: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
    status: z.enum(resultStatuses).optional(),
  })).min(1).max(500),
});

export const instituteStudentAcademicQuerySchema = z.object({
  studentId: z.string().cuid(),
});
