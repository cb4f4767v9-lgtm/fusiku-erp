import { io, type Socket } from 'socket.io-client';
import { resolveBackendOrigin } from '../config/apiBase';
import { readStoredAccessToken } from '../utils/authSession';

/**
 * Singleton socket.io client.
 *
 * Why a singleton: a websocket is an expensive long-lived resource — opening a
 * new one per component mount would burn server slots and break message
 * ordering. Components instead subscribe via `getSocket()` and clean up their
 * own listeners on unmount.
 *
 * Auth: the JWT access token is sent in `auth.token` (read at connect time).
 * The backend's `io.use(...)` middleware verifies it before any event fires.
 * If the token expires mid-session, the server kicks the client; reconnect
 * picks up the freshly-refreshed token thanks to the closure in `connect()`.
 */

let socket: Socket | null = null;

/** Set `VITE_DISABLE_WEBSOCKET=1` to skip socket.io (avoids failed WS noise; chat falls back to REST). */
export function isWebSocketDisabled(): boolean {
  return String((import.meta as any)?.env?.VITE_DISABLE_WEBSOCKET ?? '').trim() === '1';
}

function origin(): string {
  const o = resolveBackendOrigin();
  if (o) return o;
  // Same-origin fallback (Vite proxy etc.) — socket.io accepts an empty string
  // and uses `window.location.origin`.
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function getSocket(): Socket {
  if (isWebSocketDisabled()) {
    throw new Error('[socket] disabled via VITE_DISABLE_WEBSOCKET=1');
  }
  if (socket && socket.connected) return socket;
  if (socket) {
    // Disconnected (token rotated, server restart, etc.) — drop and recreate
    // so handshake auth always picks up the latest access token.
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(origin(), {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8_000,
    withCredentials: true,
    auth: (cb) => {
      // Read the latest token at every (re)connect — survives silent JWT
      // rotation in the axios interceptor.
      cb({ token: readStoredAccessToken() ?? '' });
    },
  });

  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  try {
    socket.removeAllListeners();
    socket.disconnect();
  } finally {
    socket = null;
  }
}

/**
 * Promise-based ack helper. Wraps socket.emitWithAck-style payloads where the
 * server responds with `{ ok: true, data } | { ok: false, error }`.
 */
export function emitAck<T = unknown>(
  s: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 8_000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Socket ack timed out for "${event}"`));
    }, timeoutMs);

    s.emit(event, payload, (res: { ok: true; data?: T } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      if (res && typeof res === 'object' && 'ok' in res) {
        if (res.ok) resolve((res.data as T) ?? (undefined as unknown as T));
        else reject(new Error(res.error || 'Socket error'));
      } else {
        reject(new Error('Invalid socket response'));
      }
    });
  });
}
