import { Router } from 'express';
import { body } from 'express-validator';
import { signupController } from '../controllers/signup.controller';
import { validate } from '../middlewares/validate.middleware';

const router = Router();

router.post(
  '/',
  validate([
    body('companyName').isString().trim().notEmpty().isLength({ min: 2, max: 120 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }),
  ]),
  signupController.createTenant
);

export const signupRoutes = router;
