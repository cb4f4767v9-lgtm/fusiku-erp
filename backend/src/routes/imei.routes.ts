import { Router } from 'express';
import { imeiController } from '../controllers/imei.controller';
import { imeiLookupController } from '../controllers/imeiLookup.controller';

const router = Router();

router.get('/check/:imei', imeiController.check);
router.get('/lookup/:imei', imeiLookupController.lookup);
router.get('/history/:imei', imeiController.history);
router.post('/record', imeiController.record);

export const imeiRoutes = router;
