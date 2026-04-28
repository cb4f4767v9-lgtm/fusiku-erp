import { Router } from 'express';
import { translationController } from '../controllers/translation.controller';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// Admin-only (tenant) — use existing app settings permission gate.
router.use(requirePermission('settings.app'));

router.get('/', translationController.list);
router.put('/', translationController.upsert);
router.patch('/verify', translationController.verify);
router.post('/import', translationController.importBulk);
router.get('/missing/:languageCode', translationController.missing);
router.post('/auto-fill', translationController.autoFill);

export const translationRoutes = router;

