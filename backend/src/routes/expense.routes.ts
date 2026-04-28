import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { validateBody } from '../core/validation/zodMiddleware';
import { expenseCreateBodySchema } from '../core/validation/schemas/payment.schemas';

const router = Router();

router.get('/', expenseController.list);
router.post('/', validateBody(expenseCreateBodySchema), idempotencyMiddleware, expenseController.create);

export const expenseRoutes = router;
