import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';
import { isPlatformAdminRole } from '../utils/tenantContext';

const router = Router();

const systemAdminOnly = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (isPlatformAdminRole(req.user.roleName)) {
    return next();
  }
  const user = await prisma.user.findFirst({
    where: { id: req.user.userId },
    include: { role: true },
  });
  if (!user?.role || !isPlatformAdminRole(user.role.name)) {
    return res.status(403).json({ error: 'SYSTEM_ADMIN required' });
  }
  next();
};

router.use(authMiddleware);
router.use(systemAdminOnly);

router.get('/companies', adminController.getCompanies);
router.get('/usage', adminController.getSystemUsage);
router.put('/companies/:id/disable', adminController.disableCompany);
router.put('/companies/:id/enable', adminController.enableCompany);

export const adminRoutes = router;
