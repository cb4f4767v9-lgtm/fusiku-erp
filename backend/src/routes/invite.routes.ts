import { Router } from 'express';
import { inviteController } from '../controllers/invite.controller';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// Protected: create invite
router.post('/', requirePermission('manage_users'), inviteController.create);

export const inviteRoutes = router;

