import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../core/validation/zodMiddleware';
import {
  authPreferencesBodySchema,
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  loginResendDeviceOtpBodySchema,
  loginVerifyDeviceBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from '../core/validation/schemas/auth.schemas';

const router = Router();

const refreshLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many refresh attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginDeviceLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', validateBody(loginBodySchema), authController.login);
router.post(
  '/login/verify-device',
  loginDeviceLimiter,
  validateBody(loginVerifyDeviceBodySchema),
  authController.verifyLoginDevice
);
router.post(
  '/login/resend-device-otp',
  loginDeviceLimiter,
  validateBody(loginResendDeviceOtpBodySchema),
  authController.resendLoginDeviceOtp
);

router.post('/register', validateBody(registerBodySchema), authController.register);

router.post('/refresh', refreshLimiter, authController.refresh);
router.get('/me', authMiddleware, authController.me);
router.patch(
  '/preferences',
  authMiddleware,
  validateBody(authPreferencesBodySchema),
  authController.updatePreferences
);
router.post('/logout', authMiddleware, authController.logout);

router.post('/forgot-password', validateBody(forgotPasswordBodySchema), authController.forgotPassword);

router.post('/reset-password', validateBody(resetPasswordBodySchema), authController.resetPassword);

router.post(
  '/change-password',
  authMiddleware,
  validateBody(changePasswordBodySchema),
  authController.changePassword
);

export const authRoutes = router;
