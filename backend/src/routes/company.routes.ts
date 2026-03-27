import { Router } from 'express';
import { companyController } from '../controllers/company.controller';

const router = Router();

router.get('/settings', companyController.getSettings);
router.put('/settings', companyController.updateSettings);

export const companyRoutes = router;
