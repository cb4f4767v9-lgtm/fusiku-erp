import { Router } from 'express';
import { phoneDatabaseController } from '../controllers/phoneDatabase.controller';

const router = Router();

router.get('/brands', phoneDatabaseController.getBrands);
router.get('/brands/:brandId/models', phoneDatabaseController.getModels);
router.get('/models/:modelId/variants', phoneDatabaseController.getVariants);
router.post('/brands', phoneDatabaseController.createBrand);
router.post('/models', phoneDatabaseController.createModel);
router.post('/variants', phoneDatabaseController.createVariant);

export const phoneDatabaseRoutes = router;
