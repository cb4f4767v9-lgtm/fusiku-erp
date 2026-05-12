import { Router } from 'express';
import { planController } from '../controllers/plan.controller';

const router = Router();

router.get('/', planController.listPublic);

export const planRoutes = router;
