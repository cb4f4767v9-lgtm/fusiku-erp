import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';

export const deviceGradeController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const grades = await prisma.deviceGrade.findMany({
        orderBy: { code: 'asc' }
      });
      res.json(grades);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
