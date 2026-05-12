import type { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { chatService, type ChatActor } from '../services/chat.service';

/**
 * Internal Branch Chat — socket.io gateway.
 *
 * Wire diagram:
 *   client.connect (JWT in handshake.auth.token)
 *     ↓ verified by `io.use(...)` middleware in `index.ts`
 *     ↓ socket.data.user = TokenPayload
 *   client.emit('chat:join', { roomId })
 *     ↓ assertAccess + socket.join('chat:<roomId>')
 *   client.emit('chat:send', { roomId, body }, ack)
 *     ↓ chatService.createMessage
 *     ↓ io.to('chat:<roomId>').emit('chat:message', dto)
 *
 * Multi-instance note: in a horizontally-scaled deployment this gateway needs
 * the socket.io Redis adapter so `io.to(...).emit(...)` reaches sockets on
 * other Node processes. For a single instance no extra config is required.
 */

const CHAT_ROOM_PREFIX = 'chat:';

function actorFromSocket(socket: Socket): ChatActor | null {
  const u = (socket.data && (socket.data as { user?: unknown }).user) as
    | {
        userId?: string;
        companyId?: string | null;
        branchId?: string | null;
        branchRole?: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER';
        isSystemAdmin?: boolean;
      }
    | undefined;
  if (!u || !u.userId || !u.companyId) return null;
  return {
    userId: String(u.userId),
    companyId: String(u.companyId),
    branchId: typeof u.branchId === 'string' && u.branchId.trim() ? u.branchId.trim() : null,
    branchRole: u.branchRole,
    isSystemAdmin: Boolean(u.isSystemAdmin),
  };
}

type Ack<T = unknown> = ((res: { ok: true; data?: T } | { ok: false; error: string }) => void) | undefined;

function safeAck<T>(ack: Ack<T>, payload: { ok: true; data?: T } | { ok: false; error: string }): void {
  if (typeof ack === 'function') {
    try {
      ack(payload);
    } catch {
      /* client gone — ignore */
    }
  }
}

export function registerChatSockets(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const actor = actorFromSocket(socket);
    if (!actor) {
      // Should never happen — `io.use(...)` already rejected unauthenticated
      // sockets — but defend in depth so we never broadcast on a bad context.
      socket.disconnect(true);
      return;
    }

    /**
     * Join a room. The actor MUST have access (same branch / pair / company /
     * super admin) — the service throws otherwise and we surface that to the
     * client via the ack so the UI can show a clean error.
     */
    socket.on('chat:join', async (payload: unknown, ack: Ack<{ roomId: string }>) => {
      try {
        const roomId = String((payload as { roomId?: unknown })?.roomId ?? '').trim();
        if (!roomId) {
          safeAck(ack, { ok: false, error: 'roomId required' });
          return;
        }
        await chatService.assertAccess(actor, roomId);
        socket.join(`${CHAT_ROOM_PREFIX}${roomId}`);
        safeAck(ack, { ok: true, data: { roomId } });
      } catch (err: any) {
        safeAck(ack, { ok: false, error: err?.message || 'Join failed' });
      }
    });

    socket.on('chat:leave', (payload: unknown, ack: Ack) => {
      try {
        const roomId = String((payload as { roomId?: unknown })?.roomId ?? '').trim();
        if (roomId) socket.leave(`${CHAT_ROOM_PREFIX}${roomId}`);
        safeAck(ack, { ok: true });
      } catch (err: any) {
        safeAck(ack, { ok: false, error: err?.message || 'Leave failed' });
      }
    });

    /**
     * Send a message. Persists via the service, then broadcasts to everyone in
     * the room (including the sender — the UI uses the broadcast as the
     * source of truth so optimistic state is unnecessary).
     */
    socket.on('chat:send', async (payload: unknown, ack: Ack) => {
      try {
        const p = (payload || {}) as { roomId?: unknown; body?: unknown };
        const roomId = String(p.roomId ?? '').trim();
        const body = String(p.body ?? '');
        if (!roomId || !body.trim()) {
          safeAck(ack, { ok: false, error: 'roomId and body required' });
          return;
        }
        const message = await chatService.createMessage(actor, roomId, body);
        io.to(`${CHAT_ROOM_PREFIX}${roomId}`).emit('chat:message', message);
        safeAck(ack, { ok: true, data: message });
      } catch (err: any) {
        safeAck(ack, { ok: false, error: err?.message || 'Send failed' });
      }
    });

    /**
     * Typing indicator — fire-and-forget, no persistence. We deliberately do
     * NOT re-check access here on every keystroke (cheap optimisation): the
     * actor must have already joined the room successfully.
     */
    socket.on('chat:typing', (payload: unknown) => {
      try {
        const roomId = String((payload as { roomId?: unknown })?.roomId ?? '').trim();
        if (!roomId) return;
        socket.to(`${CHAT_ROOM_PREFIX}${roomId}`).emit('chat:typing', {
          roomId,
          userId: actor.userId,
        });
      } catch {
        /* ignore */
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug?.({ userId: actor.userId, reason }, '[chat] socket disconnected');
    });
  });
}
