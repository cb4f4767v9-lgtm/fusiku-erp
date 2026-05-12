import { Router } from 'express';

const router = Router();

router.get('/summary', async (req, res) => {
  res.json({
    totalSales: 0,
    monthlyProfit: 0,
    topModel: 'No data',
    lowStock: 0,
    repairsInProgress: 0
  });
});

export default router;
