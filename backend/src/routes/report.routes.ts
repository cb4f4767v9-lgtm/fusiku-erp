import { Router } from 'express';
import { reportController } from '../controllers/report.controller';

const router = Router();

router.get('/dashboard', reportController.getDashboard);
router.get('/sales', reportController.getSalesReport);
router.get('/inventory', reportController.getInventoryReport);
router.get('/profit', reportController.getProfitReport);
router.get('/technicians', reportController.getTechniciansReport);
router.get('/inventory-aging', reportController.getInventoryAging);
router.get('/inventory-financial', reportController.getInventoryFinancial);
router.get('/inventory-market-value', reportController.getInventoryMarketValue);
router.get('/top-selling-models', reportController.getTopSellingModels);
router.get('/top-technicians', reportController.getTopTechnicians);
router.get('/monthly-revenue', reportController.getMonthlyRevenue);
router.get('/inventory-distribution', reportController.getInventoryDistribution);
router.get('/export-sales', reportController.exportSales);
router.get('/export-inventory', reportController.exportInventory);

export const reportRoutes = router;
