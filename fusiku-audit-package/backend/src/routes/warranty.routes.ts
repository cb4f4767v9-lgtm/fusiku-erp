import { Router } from 'express';
import { warrantyController } from '../controllers/warranty.controller';

const router = Router();

router.get('/:imei', warrantyController.getByImei);

export const warrantyRoutes = router;
