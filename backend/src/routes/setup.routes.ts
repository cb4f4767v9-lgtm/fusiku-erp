import { Router } from 'express';
import { setupController } from '../controllers/setup.controller';

const router = Router();

router.get('/status', setupController.getStatus);
router.post('/complete', setupController.complete);

export const setupRoutes = router;
