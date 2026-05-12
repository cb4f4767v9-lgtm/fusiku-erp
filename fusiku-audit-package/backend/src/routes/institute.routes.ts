import { Router } from 'express';
import { instituteController } from '../controllers/institute.controller';
import { validateBody, validateQuery } from '../core/validation/zodMiddleware';
import { requirePermission } from '../middlewares/permission.middleware';
import {
  instituteBatchListQuerySchema,
  instituteCreateBatchBodySchema,
  instituteCreateCourseBodySchema,
  instituteCreateStudentBodySchema,
  instituteCourseListQuerySchema,
  instituteStudentListQuerySchema,
} from '../core/validation/schemas/institute.schemas';

const router = Router();

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

export const instituteRoutes = router;
