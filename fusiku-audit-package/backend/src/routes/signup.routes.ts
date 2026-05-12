import { Router } from 'express';
import { body } from 'express-validator';
import { signupController } from '../controllers/signup.controller';
import { validate } from '../middlewares/validate.middleware';
import { assertPublicSignupPasswordStrength } from '../utils/validation';

const router = Router();

const signupBodyValidators = [
  body('companyName').isString().trim().notEmpty().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .custom((value) => {
      try {
        assertPublicSignupPasswordStrength(value);
        return true;
      } catch (err: unknown) {
        throw new Error(err instanceof Error ? err.message : 'Invalid password');
      }
    }),
  body('businessType').optional().isString(),
  body('phone')
    .optional()
    .isString()
    .trim()
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage('Invalid phone number'),
];

router.post('/start', validate(signupBodyValidators), signupController.start);

router.post(
  '/verify',
  validate([
    body('challengeId').isUUID(),
    body('code').matches(/^\d{6}$/).withMessage('Code must be 6 digits'),
  ]),
  signupController.verify
);

router.post('/resend', validate([body('challengeId').isUUID()]), signupController.resend);

export const signupRoutes = router;
