import { Router } from 'express';
import { masterDataController } from '../controllers/masterData.controller';

const router = Router({ mergeParams: true });

router.get('/:entity', masterDataController.getAll);
router.post('/:entity', masterDataController.create);
router.put('/:entity/:id', masterDataController.update);
router.delete('/:entity/:id', masterDataController.delete);

export const masterDataRoutes = router;
