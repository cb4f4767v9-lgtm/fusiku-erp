import { Router } from 'express';
import { prisma } from '../utils/prisma';

const router = Router();

router.get('/', async (_, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { code: 'asc' }
    });
    res.json(permissions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const permissionRoutes = router;
