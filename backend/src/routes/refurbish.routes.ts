import { Router } from 'express';
import { refurbishController } from '../controllers/refurbish.controller';

const router = Router();

router.get('/', refurbishController.getAll);
router.get('/:id', refurbishController.getById);
router.post('/', refurbishController.create);
router.put('/:id', refurbishController.update);

export const refurbishRoutes = router;
