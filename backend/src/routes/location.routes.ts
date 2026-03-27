import { Router } from 'express';
import { locationController } from '../controllers/location.controller';

const router = Router();

router.get('/countries', locationController.getCountries);
router.get('/provinces', locationController.getProvinces);
router.get('/cities', locationController.getCities);

export const locationRoutes = router;
