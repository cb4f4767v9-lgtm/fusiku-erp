import { Router } from 'express';
import { requirePermission } from '../middlewares/permission.middleware';
import { partCatalogController } from '../controllers/partCatalog.controller';

const router = Router();

router.get('/tree', requirePermission('parts.catalog.view'), partCatalogController.tree);
router.get('/suggestions', requirePermission('parts.catalog.manage'), partCatalogController.listSuggestions);
router.post('/suggestions', requirePermission('parts.catalog.suggest'), partCatalogController.createSuggestion);
router.post('/suggestions/:id/apply', requirePermission('parts.catalog.manage'), partCatalogController.applySuggestion);
router.post('/suggestions/:id/reject', requirePermission('parts.catalog.manage'), partCatalogController.rejectSuggestion);

export const partCatalogRoutes = router;
