import crypto from 'crypto';

/** Public self-registration (default off for SaaS safety). */
export function isPublicRegisterAllowed(): boolean {
  const v = String(process.env.ALLOW_PUBLIC_REGISTER || 'false').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Server-to-server bypass when `INTERNAL_REGISTER_TOKEN` is set (min 16 chars).
 * Caller must send `X-Internal-Register-Token` matching the env value exactly.
 */
export function isInternalRegisterTokenValid(token: string | undefined): boolean {
  const secret = process.env.INTERNAL_REGISTER_TOKEN?.trim();
  if (!secret || secret.length < 16) return false;
  const t = String(token || '').trim();
  if (!t) return false;
  try {
    const a = Buffer.from(secret, 'utf8');
    const b = Buffer.from(t, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function assertRegisterEndpointAllowed(internalToken?: string): void {
  if (isPublicRegisterAllowed()) return;
  if (isInternalRegisterTokenValid(internalToken)) return;
  const err = new Error('Registration not available') as Error & { statusCode?: number };
  err.statusCode = 403;
  throw err;
}
