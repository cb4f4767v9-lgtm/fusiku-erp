import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';

const router = Router();

router.post('/checkout', billingController.checkout);
router.post('/portal', billingController.portal);
router.post('/choose-plan', billingController.choosePlan);

export const billingRoutes = router;

