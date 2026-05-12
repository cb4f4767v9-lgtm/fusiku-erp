import { Response } from 'express';
import type { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.middleware';
import {
  instituteBatchListQuerySchema,
  instituteCourseListQuerySchema,
  instituteStudentListQuerySchema,
} from '../core/validation/schemas/institute.schemas';
import { instituteStudentService } from '../services/institute/instituteStudent.service';
import { instituteCourseService } from '../services/institute/instituteCourse.service';
import { instituteBatchService } from '../services/institute/instituteBatch.service';

type StudentListQuery = z.infer<typeof instituteStudentListQuerySchema>;
type CourseListQuery = z.infer<typeof instituteCourseListQuerySchema>;
type BatchListQuery = z.infer<typeof instituteBatchListQuerySchema>;

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
  return 'Duplicate record';
}

export const instituteController = {
  async listStudents(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: StudentListQuery }).validatedQuery;
      const rows = await instituteStudentService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to list students';
      res.status(500).json({ error: msg });
    }
  },

  async createStudent(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteStudentService.create(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      const dup = prismaConflictMessage(e);
      if (dup) return res.status(409).json({ error: dup });
      const err = e as { statusCode?: number; message?: string };
      if (err.statusCode === 400) return res.status(400).json({ error: err.message });
      const msg = e instanceof Error ? e.message : 'Failed to create student';
      res.status(500).json({ error: msg });
    }
  },

  async listCourses(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: CourseListQuery }).validatedQuery;
      const rows = await instituteCourseService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to list courses';
      res.status(500).json({ error: msg });
    }
  },

  async createCourse(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteCourseService.create(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      const dup = prismaConflictMessage(e);
      if (dup) return res.status(409).json({ error: dup });
      const msg = e instanceof Error ? e.message : 'Failed to create course';
      res.status(500).json({ error: msg });
    }
  },

  async listBatches(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const vq = (req as AuthRequest & { validatedQuery?: BatchListQuery }).validatedQuery;
      const rows = await instituteBatchService.list(companyId, vq ?? {});
      res.json(rows);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      if (err.statusCode === 400) return res.status(400).json({ error: err.message });
      const msg = e instanceof Error ? e.message : 'Failed to list batches';
      res.status(500).json({ error: msg });
    }
  },

  async createBatch(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const row = await instituteBatchService.create(companyId, req.body);
      res.status(201).json(row);
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      if (err.statusCode === 400) return res.status(400).json({ error: err.message });
      const msg = e instanceof Error ? e.message : 'Failed to create batch';
      res.status(500).json({ error: msg });
    }
  },
};
