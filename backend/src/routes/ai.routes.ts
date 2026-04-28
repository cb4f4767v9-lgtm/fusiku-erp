import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { branchQueryGuard } from '../core/auth/branchGuard';

const router = Router();

router.get('/device-identify/:imei', aiController.deviceIdentify);
router.get('/repair-suggestions', aiController.repairSuggestions);
router.get('/price-estimate', aiController.priceEstimate);
router.post('/condition-suggest', aiController.conditionSuggest);
router.get('/insights', branchQueryGuard, aiController.insights);
router.get('/price-optimize', branchQueryGuard, aiController.priceOptimize);
router.get('/business-intelligence', branchQueryGuard, aiController.businessIntelligence);
router.get('/business-engine', branchQueryGuard, aiController.businessEngine);
router.get('/pricing-suggestions', branchQueryGuard, aiController.pricingSuggestions);
router.get('/high-demand', branchQueryGuard, aiController.highDemand);
router.get('/low-stock-risks', branchQueryGuard, aiController.lowStockRisks);
router.post('/simulate', aiController.simulate);
router.get('/alerts', aiController.getAlerts);
router.put('/alerts/:id/read', aiController.markAlertRead);
router.post('/ask', aiController.ask);

export const aiRoutes = router;
