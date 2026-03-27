import { Router } from 'express';
import { stockMovementService } from '../services/stockMovement.service';

const router = Router();

router.get('/inventory/:inventoryId', async (req, res) => {
  try {
    const movements = await stockMovementService.getByInventory(req.params.inventoryId);
    res.json(movements);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { branchId, type, inventoryId, startDate, endDate } = req.query;
    const movements = branchId
      ? await stockMovementService.getByBranch(branchId as string, {
          type: type as string,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined
        })
      : await stockMovementService.getAll({
          branchId: branchId as string,
          type: type as string,
          inventoryId: inventoryId as string,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined
        });
    res.json(movements);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const stockMovementRoutes = router;
