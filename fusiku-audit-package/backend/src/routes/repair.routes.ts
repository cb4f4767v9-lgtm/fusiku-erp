import { Router } from 'express';
import { repairController } from '../controllers/repair.controller';

const router = Router();

router.get('/', repairController.getAll);
router.get('/:id', repairController.getById);
router.post('/', repairController.create);
router.put('/:id', repairController.update);

export const repairRoutes = router;
