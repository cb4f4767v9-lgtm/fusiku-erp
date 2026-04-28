import type { Request, RequestHandler } from 'express';
import { getRequestBaseLanguage, getRequestCurrencyCode } from '../utils/requestLanguage';
import { textDirectionForLanguage } from '../utils/supportedLocale';

export type ApiResponseMeta = {
  language: string;
  direction: 'ltr' | 'rtl';
  currency: string;
};

function buildResponseMeta(req: Request): ApiResponseMeta {
  const language = getRequestBaseLanguage(req);
  return {
    language,
    direction: textDirectionForLanguage(language),
    currency: getRequestCurrencyCode(req),
  };
}

/**
 * Paths whose JSON must not be wrapped (health probes, public contract, Electron manifest).
 * Only 2xx object bodies are wrapped elsewhere.
 */
function shouldSkipEnvelope(path: string): boolean {
  if (path === '/api/health' || path === '/api/version' || path === '/api/version/') return true;
  if (path === '/version.json') return true;
  if (path.startsWith('/api/public/')) return true;
  return false;
}

/**
 * Wraps JSON responses when not already shaped:
 * - 2xx objects/arrays → `{ success: true, data }`
 * - 4xx/5xx objects → `{ success: false, message, code? }`
 * Skipped paths are unchanged. Pairs with frontend axios success unwrapping.
 */
export function apiSuccessEnvelopeMiddleware(): RequestHandler {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (shouldSkipEnvelope(req.path)) {
        return origJson(body);
      }

      const code = res.statusCode;

      if (body === undefined || body === null) {
        return origJson(body);
      }

      if (typeof body !== 'object') {
        return origJson(body);
      }

      const rec = body as Record<string, unknown>;
      const meta = buildResponseMeta(req);

      // Controllers that pre-shape `{ success, ... }` still receive globalization `meta`
      // (language / direction / currency) without stripping their payload.
      if ('success' in rec) {
        return origJson({ ...rec, meta });
      }

      // Preserve canonical error payloads produced by the global error middleware.
      if ('error' in rec && req.path.startsWith('/api/')) {
        return origJson({ ...rec, meta });
      }

      if (code >= 200 && code < 300) {
        if (Array.isArray(body)) {
          return origJson({ success: true, data: body, meta });
        }
        return origJson({ success: true, data: body, meta });
      }

      if (code >= 400) {
        const message =
          typeof rec.error === 'string'
            ? rec.error
            : rec.error !== undefined
              ? rec.error
              : typeof rec.message === 'string'
                ? rec.message
                : rec.errors !== undefined
                  ? rec.errors
                  : 'Request failed';
        return origJson({
          success: false,
          message,
          ...(rec.code !== undefined ? { code: rec.code } : {}),
          meta,
        });
      }

      return origJson(body);
    };
    next();
  };
}
