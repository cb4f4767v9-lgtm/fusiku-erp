import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ]),
  authController.login
);

router.post('/register',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty().trim(),
    body('roleId').notEmpty()
  ]),
  authController.register
);

router.post('/refresh', authController.refresh);

router.post('/forgot-password',
  validate([body('email').isEmail().normalizeEmail()]),
  authController.forgotPassword
);

router.post('/reset-password',
  validate([
    body('token').notEmpty(),
    body('password').isLength({ min: 6 })
  ]),
  authController.resetPassword
);

router.post('/change-password',
  authMiddleware,
  validate([
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
  ]),
  authController.changePassword
);

export const authRoutes = router;
