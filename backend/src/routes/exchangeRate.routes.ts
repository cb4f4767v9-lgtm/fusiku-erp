import { Router } from 'express';
import { exchangeRateController } from '../controllers/exchangeRate.controller';

const router = Router();

router.get('/', exchangeRateController.getAll);
router.get('/:currency', exchangeRateController.getCurrent);
router.post('/', exchangeRateController.create);

export const exchangeRateRoutes = router;
