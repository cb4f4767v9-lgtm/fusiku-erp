import { Router } from 'express';
import { deviceSpecsController } from '../controllers/deviceSpecs.controller';

const router = Router();

router.get('/:model', deviceSpecsController.getByModel);

export const deviceSpecsRoutes = router;
