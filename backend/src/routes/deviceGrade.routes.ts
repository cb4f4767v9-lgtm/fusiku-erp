import { Router } from 'express';
import { deviceGradeController } from '../controllers/deviceGrade.controller';

const router = Router();

router.get('/', deviceGradeController.getAll);

export const deviceGradeRoutes = router;
