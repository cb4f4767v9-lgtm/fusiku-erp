import { Router } from 'express';
import { currencyController } from '../controllers/currency.controller';
import { exchangeRateHistoryController } from '../controllers/exchangeRateHistory.controller';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// All branches can read final rates (offline fallback handled client-side).
router.get('/', currencyController.list);
router.get('/rates', currencyController.rates);
router.get('/ledger-config', currencyController.ledgerConfig);
router.get('/quotes', currencyController.quotes);
router.get('/exchange-history', exchangeRateHistoryController.list);
router.get('/:code/history', currencyController.history);

// Head Office controls
router.post(
  '/refresh',
  requirePermission('manage_currency'),
  currencyController.refresh
);
router.post(
  '/manual-update',
  requirePermission('manage_currency'),
  currencyController.manualUpdate
);
router.patch(
  '/:code',
  requirePermission('manage_currency'),
  currencyController.update
);

export const currencyRoutes = router;

