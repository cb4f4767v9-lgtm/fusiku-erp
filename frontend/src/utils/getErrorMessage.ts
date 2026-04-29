const MESSAGE_KEYS = ['error', 'msg', 'message'] as const;

/** express-validator / similar: `{ errors: [{ msg: string, ... }] }` */
function pickValidationErrorsMessage(data: unknown): string | null {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return null;
  const errs = (data as { errors?: unknown }).errors;
  if (!Array.isArray(errs) || !errs.length) return null;
  const parts: string[] = [];
  for (const item of errs) {
    if (item != null && typeof item === 'object' && !Array.isArray(item)) {
      const msg = (item as { msg?: unknown }).msg;
      if (typeof msg === 'string' && msg.trim()) parts.push(msg.trim());
    } else {
      const p = pickMessageFromPayload(item, 0);
      if (p) parts.push(p);
    }
  }
  return parts.length ? parts.join('; ') : null;
}

function pickMessageFromPayload(data: unknown, depth = 0): string | null {
  if (data == null || depth > 6) return null;

  if (typeof data === 'string') {
    const s = data.trim();
    return s || null;
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }

  if (Array.isArray(data)) {
    const parts: string[] = [];
    for (const item of data) {
      const piece = pickMessageFromPayload(item, depth + 1);
      if (piece) parts.push(piece);
    }
    return parts.length ? parts.join('; ') : null;
  }

  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of MESSAGE_KEYS) {
      const v = o[key];
      if (typeof v === 'string') {
        const s = v.trim();
        if (s) return s;
      }
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (v != null && typeof v === 'object') {
        const nested = pickMessageFromPayload(v, depth + 1);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/**
 * Coerce API / Axios / Error values to a plain string safe for React children and toasts.
 * Axios errors extend `Error` but carry the real message on `response.data` (e.g. `{ error: 'Invalid credentials' }`
 * or `{ success: false, error: '...' }`); we must read that before `err.message` (which is only "Request failed with status code 401").
 */
export function getErrorMessage(err: unknown, fallback = 'Unable to load data'): string {
  if (err == null) return fallback;

  if (typeof err === 'string') {
    const s = err.trim();
    return s || fallback;
  }
  if (typeof err === 'number' || typeof err === 'boolean') {
    return String(err);
  }

  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>;

    const response = o.response;
    if (response && typeof response === 'object') {
      const status = (response as { status?: number }).status;
      const data = (response as { data?: unknown }).data;
      const reqUrl = String((response as { config?: { url?: string } }).config?.url || '');

      if (status === 401) {
        const fromData401 = pickMessageFromPayload(data);
        if (fromData401) return fromData401;
        if (!reqUrl.includes('/auth/login') && !reqUrl.includes('/auth/register')) {
          return 'Session expired. Please sign in again.';
        }
      }
      if (status === 403) return 'You do not have access to this resource.';
      if (status === 404) return 'No data available.';
      if (status === 503) {
        const m = pickMessageFromPayload(data);
        if (m) return m;
        return 'The server is temporarily unavailable. Try again in a moment.';
      }
      const fromValidation = pickValidationErrorsMessage(data);
      if (fromValidation) return fromValidation;
      const fromData = pickMessageFromPayload(data);
      if (fromData) return fromData;
    }

    const top = pickMessageFromPayload(o);
    if (top) return top;
  }

  if (err instanceof Error) {
    const m = err.message?.trim();
    return m || fallback;
  }

  return fallback;
}
