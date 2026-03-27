import { Router } from 'express';
import { stockAlertController } from '../controllers/stockAlert.controller';

const router = Router();

router.get('/', stockAlertController.getAlerts);
router.post('/check', stockAlertController.checkAlerts);
router.put('/:id/read', stockAlertController.markRead);

export const stockAlertRoutes = router;
