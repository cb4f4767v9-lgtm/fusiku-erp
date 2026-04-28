import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { prismaPlatform } from '../utils/prismaPlatform';
import { isPlatformAdminRole } from '../utils/tenantContext';
import { incidentsRoutes } from './incidents.routes';

const router = Router();

const systemAdminOnly = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (isPlatformAdminRole(req.user.roleName)) {
    return next();
  }
  const user = await prismaPlatform.user.findFirst({
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
router.get('/companies/:id/usage', adminController.getCompanyUsage);
router.put('/companies/:id/plan', adminController.changeCompanyPlan);
router.get('/companies/:id', adminController.getCompany);
router.get('/usage', adminController.getSystemUsage);
router.put('/companies/:id/disable', adminController.disableCompany);
router.put('/companies/:id/enable', adminController.enableCompany);

// Self-healing / incident management
router.use('/incidents', incidentsRoutes);

export const adminRoutes = router;
