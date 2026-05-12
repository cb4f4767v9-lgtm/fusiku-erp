import { Router } from 'express';
import { prisma } from '../utils/prisma';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { entity, userId, limit } = req.query;
    const where: any = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 100, 500)
    });
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const logsRoutes = router;
