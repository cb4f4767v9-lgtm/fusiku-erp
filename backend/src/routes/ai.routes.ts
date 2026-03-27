import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';

const router = Router();

router.get('/device-identify/:imei', aiController.deviceIdentify);
router.get('/repair-suggestions', aiController.repairSuggestions);
router.get('/price-estimate', aiController.priceEstimate);
router.post('/condition-suggest', aiController.conditionSuggest);
router.get('/insights', aiController.insights);
router.get('/price-optimize', aiController.priceOptimize);
router.get('/business-intelligence', aiController.businessIntelligence);
router.get('/alerts', aiController.getAlerts);
router.put('/alerts/:id/read', aiController.markAlertRead);

export const aiRoutes = router;
