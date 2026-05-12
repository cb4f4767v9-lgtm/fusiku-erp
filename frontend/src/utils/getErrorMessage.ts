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

/** Raw API body text for dev-only diagnostics (never show stacks to end users in prod UI). */
export function extractApiErrorRawText(err: unknown): string {
  if (err == null || typeof err !== 'object') return '';
  const o = err as Record<string, unknown>;
  const response = o.response;
  if (response && typeof response === 'object') {
    const data = (response as { data?: unknown }).data;
    if (typeof data === 'string') return data.trim();
    const picked = pickMessageFromPayload(data);
    return picked?.trim() || '';
  }
  if (err instanceof Error) return err.message?.trim() || '';
  return '';
}

export function isLikelyDbSchemaMismatchMessage(msg: string): boolean {
  const s = msg.trim();
  if (!s) return false;
  if (/does not exist in the current database/i.test(s)) return true;
  if (/Unknown column/i.test(s)) return true;
  if (/The column `[^`]+` does not exist/i.test(s)) return true;
  if (/relation .* does not exist/i.test(s)) return true;
  return false;
}

function needsInfrastructureSanitize(msg: string): boolean {
  const s = msg.trim();
  if (!s) return false;
  if (isLikelyDbSchemaMismatchMessage(s)) return true;
  if (/PrismaClient/i.test(s)) return true;
  if (/Invalid `prisma\./i.test(s)) return true;
  if (/\bprisma\b/i.test(s) && s.length > 120) return true;
  return false;
}

/**
 * Replace raw Prisma / DB engine dumps with short, human-readable copy.
 * Never intended for server logs — UI / toasts only.
 */
export function sanitizeClientErrorMessage(msg: string): string {
  const s = msg.trim();
  if (!s) return s;
  if (isLikelyDbSchemaMismatchMessage(s)) {
    return 'Database schema needs an update for new features. Ask your administrator to run the latest migrations (for example: prisma migrate deploy), then refresh.';
  }
  if (/PrismaClient/i.test(s) || /Invalid `prisma\./i.test(s)) {
    return 'A database error occurred. Try again shortly. If it keeps happening, contact support.';
  }
  const first = s.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || s;
  if (first.length > 700) return `${first.slice(0, 680)}…`;
  return first;
}

function finalizeClientMessage(msg: string, status?: number): string {
  const s = msg.trim();
  if (!s) return msg;
  if (status === 401 || status === 403 || status === 404) return s;
  if (needsInfrastructureSanitize(s)) return sanitizeClientErrorMessage(s);
  if (s.length > 1200) return `${s.slice(0, 1180)}…`;
  return s;
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
    if (!s) return fallback;
    return finalizeClientMessage(s);
  }
  if (typeof err === 'number' || typeof err === 'boolean') {
    return finalizeClientMessage(String(err));
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
        if (fromData401) return finalizeClientMessage(fromData401, status);
        if (!reqUrl.includes('/auth/login') && !reqUrl.includes('/auth/register')) {
          return 'Session expired. Please login again.';
        }
      }
      if (status === 403) return 'You do not have access to this resource.';
      if (status === 404) return 'No data available.';
      if (status === 503) {
        const m = pickMessageFromPayload(data);
        if (m) return finalizeClientMessage(m, status);
        return 'The server is temporarily unavailable. Try again in a moment.';
      }
      const fromValidation = pickValidationErrorsMessage(data);
      if (fromValidation) return finalizeClientMessage(fromValidation, status);
      const fromData = pickMessageFromPayload(data);
      if (fromData) return finalizeClientMessage(fromData, status);
    }

    const top = pickMessageFromPayload(o);
    if (top) return finalizeClientMessage(top);
  }

  if (err instanceof Error) {
    const m = err.message?.trim();
    return m ? finalizeClientMessage(m) : fallback;
  }

  return fallback;
}
