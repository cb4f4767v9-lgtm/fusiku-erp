import { Router } from 'express';
import { investorController } from '../controllers/investor.controller';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

router.get('/capital-summary', requirePermission('manage_investors'), investorController.capitalSummary);
router.get('/financial-report', requirePermission('manage_investors'), investorController.financialReport);
router.get('/', requirePermission('manage_investors'), investorController.list);
router.post('/', requirePermission('manage_investors'), investorController.create);
router.get('/:id', requirePermission('manage_investors'), investorController.getById);
router.get('/:id/transactions', requirePermission('manage_investors'), investorController.listTransactions);
router.post('/:id/transactions', requirePermission('manage_investors'), investorController.addTransaction);
router.get('/:id/profit-distributions', requirePermission('manage_investors'), investorController.listProfitDistributions);
router.post('/:id/profit-distributions', requirePermission('manage_investors'), investorController.addProfitDistribution);

export const investorRoutes = router;
