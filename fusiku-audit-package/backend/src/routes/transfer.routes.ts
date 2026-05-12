import { Router } from 'express';
import { transferController } from '../controllers/transfer.controller';

const router = Router();

router.get('/', transferController.getAll);
router.get('/:id', transferController.getById);
router.post('/', transferController.create);
router.post('/:id/approve', transferController.approve);

export const transferRoutes = router;
