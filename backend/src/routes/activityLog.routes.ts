import { Router } from 'express';
import { activityLogController } from '../controllers/activityLog.controller';

const router = Router();

router.get('/', activityLogController.getAll);

export const activityLogRoutes = router;
