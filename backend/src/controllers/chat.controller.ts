import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { chatService, type ChatActor } from '../services/chat.service';
import type {
  ChatMessageCreateBody,
  ChatRoomOpenBody,
} from '../core/validation/schemas/chat.schemas';

/**
 * Build a `ChatActor` from `req.user` populated by `authMiddleware`. Every
 * action is tenant-scoped, so we fail closed if `companyId` is missing.
 */
function actorFromRequest(req: AuthRequest): ChatActor {
  const u = req.user || {};
  const companyId = String(u.companyId || '').trim();
  if (!companyId) {
    const err = new Error('Tenant context missing') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }
  return {
    userId: String(u.userId || u.id || ''),
    companyId,
    branchId: typeof u.branchId === 'string' && u.branchId.trim() ? u.branchId.trim() : null,
    branchRole: u.branchRole,
    isSystemAdmin: Boolean(u.isSystemAdmin),
  };
}

export const chatController = {
  /** GET /chat/rooms — rooms visible to the actor (auto-creates COMPANY + own BRANCH). */
  async listRooms(req: AuthRequest, res: Response) {
    try {
      const actor = actorFromRequest(req);
      const rooms = await chatService.listRoomsForUser(actor);
      return res.json({ success: true, data: rooms });
    } catch (e: any) {
      return res
        .status(e?.statusCode ?? 400)
        .json({ success: false, message: e.message, code: 'CHAT_LIST_ROOMS_FAILED' });
    }
  },

  /**
   * POST /chat/rooms — open or create a room.
   *
   *  - Empty body → actor's own branch room (or company-wide if no branch).
   *  - `{ kind: 'COMPANY' }` → company-wide room.
   *  - `{ branchId }` → that branch's room (super admin only — others get 403).
   *  - `{ withBranchId }` → pair room between actor's branch and target.
   */
  async openRoom(req: AuthRequest, res: Response) {
    try {
      const actor = actorFromRequest(req);
      const body = (req.body ?? {}) as ChatRoomOpenBody;

      if (body.kind === 'COMPANY') {
        const room = await chatService.ensureCompanyRoom(actor.companyId);
        return res.status(200).json({ success: true, data: room });
      }

      if (body.withBranchId) {
        const myBranch = body.branchId ?? actor.branchId;
        if (!myBranch) {
          return res.status(400).json({
            success: false,
            message: 'No source branch available for pair room',
          });
        }
        const isSuper =
          actor.isSystemAdmin || actor.branchRole === 'SUPER_ADMIN' || !actor.branchId;
        if (!isSuper && myBranch !== actor.branchId) {
          return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const room = await chatService.ensureBranchPairRoom(
          actor.companyId,
          myBranch,
          body.withBranchId
        );
        return res.status(200).json({ success: true, data: room });
      }

      if (body.branchId) {
        const isSuper =
          actor.isSystemAdmin || actor.branchRole === 'SUPER_ADMIN' || !actor.branchId;
        if (!isSuper && body.branchId !== actor.branchId) {
          return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const room = await chatService.ensureBranchRoom(actor.companyId, body.branchId);
        return res.status(200).json({ success: true, data: room });
      }

      // Default: actor's own branch room, falling back to company-wide.
      if (actor.branchId) {
        const room = await chatService.ensureBranchRoom(actor.companyId, actor.branchId);
        return res.status(200).json({ success: true, data: room });
      }
      const room = await chatService.ensureCompanyRoom(actor.companyId);
      return res.status(200).json({ success: true, data: room });
    } catch (e: any) {
      return res
        .status(e?.statusCode ?? 400)
        .json({ success: false, message: e.message, code: 'CHAT_OPEN_ROOM_FAILED' });
    }
  },

  /** GET /chat/rooms/:roomId/messages?take=50&before=2026-05-09T... */
  async listMessages(req: AuthRequest, res: Response) {
    try {
      const actor = actorFromRequest(req);
      const roomId =
        ((req as any).validatedParams?.roomId as string | undefined) ?? req.params.roomId;
      const vq = (req as any).validatedQuery as { take?: number; before?: Date } | undefined;
      const messages = await chatService.listMessages(actor, roomId, {
        take: vq?.take,
        before: vq?.before,
      });
      return res.json({ success: true, data: messages });
    } catch (e: any) {
      return res
        .status(e?.statusCode ?? 400)
        .json({ success: false, message: e.message, code: 'CHAT_LIST_MESSAGES_FAILED' });
    }
  },

  /**
   * POST /chat/rooms/:roomId/messages — REST fallback when the websocket isn't
   * connected (offline-tolerant clients, mobile background, etc.).
   *
   * Note: socket.io clients should use the `chat:send` event for live
   * broadcast — REST writes won't be pushed to other connected clients in this
   * minimal implementation (would require Redis pub/sub for multi-instance).
   */
  async createMessage(req: AuthRequest, res: Response) {
    try {
      const actor = actorFromRequest(req);
      const roomId =
        ((req as any).validatedParams?.roomId as string | undefined) ?? req.params.roomId;
      const body = req.body as ChatMessageCreateBody;
      const message = await chatService.createMessage(actor, roomId, body.body);
      return res.status(201).json({ success: true, data: message });
    } catch (e: any) {
      return res
        .status(e?.statusCode ?? 400)
        .json({ success: false, message: e.message, code: 'CHAT_SEND_FAILED' });
    }
  },
};
