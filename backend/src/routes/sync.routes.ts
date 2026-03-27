import { Router } from 'express';
import { syncEnqueue, syncFlush, syncReceive, syncStatus } from '../controllers/sync.controller';

const syncRoutes = Router();

syncRoutes.get('/status', syncStatus);
syncRoutes.post('/enqueue', syncEnqueue);
syncRoutes.post('/flush', syncFlush);
syncRoutes.post('/receive', syncReceive);

export { syncRoutes };
