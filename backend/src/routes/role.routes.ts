import { Router } from 'express';
import { prisma } from '../utils/prisma';

const router = Router();

router.get('/', async (_, res) => {
  try {
    const roles = await prisma.role.findMany();
    res.json(roles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const roleRoutes = router;
