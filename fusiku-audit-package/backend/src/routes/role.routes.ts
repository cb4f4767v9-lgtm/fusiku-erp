import { Response, Router } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { isPlatformAdminRole } from '../utils/tenantContext';

const router = Router();

/** Tenant admins must not assign the platform SystemAdmin role via HR UI. */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const platform = req.user?.isSystemAdmin || isPlatformAdminRole(req.user?.roleName);
    const roles = await prisma.role.findMany({
      where: platform
        ? undefined
        : { NOT: { name: { in: ['SystemAdmin', 'SYSTEM_ADMIN'] } } },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const roleRoutes = router;
