import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { validateBody, validateParams, validateQuery } from '../core/validation/zodMiddleware';
import {
  chatMessageCreateBodySchema,
  chatMessageListQuerySchema,
  chatRoomIdParamSchema,
  chatRoomOpenBodySchema,
} from '../core/validation/schemas/chat.schemas';

const router = Router();

router.get('/rooms', chatController.listRooms);
router.post('/rooms', validateBody(chatRoomOpenBodySchema), chatController.openRoom);
router.get(
  '/rooms/:roomId/messages',
  validateParams(chatRoomIdParamSchema),
  validateQuery(chatMessageListQuerySchema),
  chatController.listMessages
);
router.post(
  '/rooms/:roomId/messages',
  validateParams(chatRoomIdParamSchema),
  validateBody(chatMessageCreateBodySchema),
  chatController.createMessage
);

export const chatRoutes = router;
