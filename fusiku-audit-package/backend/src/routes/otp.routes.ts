import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { otpController } from '../controllers/otp.controller';
import { validateBody } from '../core/validation/zodMiddleware';
import { otpRequestBodySchema, otpVerifyBodySchema } from '../core/validation/schemas/otp.schemas';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/request', otpLimiter, validateBody(otpRequestBodySchema), otpController.request);
router.post('/verify', otpLimiter, validateBody(otpVerifyBodySchema), otpController.verify);

export const otpRoutes = router;

