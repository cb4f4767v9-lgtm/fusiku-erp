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

export const instituteCreateStudentBodySchema = z.object({
  fullName: z.string().trim().min(1).max(500),
  studentCode: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(128).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().max(320).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  branchId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  status: z.string().trim().max(64).optional().default('active'),
});

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
});
