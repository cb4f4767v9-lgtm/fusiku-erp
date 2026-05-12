import type { Request } from 'express';

/** Best-effort client IP (honors X-Forwarded-For first hop when present). */
export function clientIpFromRequest(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  const raw =
    typeof xf === 'string'
      ? xf.split(',')[0]?.trim()
      : Array.isArray(xf)
        ? String(xf[0] || '').trim()
        : '';
  if (raw) return raw.slice(0, 128);
  const sock = req.socket?.remoteAddress;
  return typeof sock === 'string' ? sock.slice(0, 128) : '';
}

/** Human-readable location hint (CDN country header + IP); not precise geo. */
export function loginLocationLabel(req: Request, ip: string): string {
  const cf = req.headers['cf-ipcountry'];
  const country =
    typeof cf === 'string' && /^[A-Za-z]{2}$/.test(cf.trim()) ? cf.trim().toUpperCase() : '';
  if (country && ip) return `Country ${country} · IP ${ip}`;
  if (country) return `Country ${country}`;
  if (ip) return `IP ${ip}`;
  return 'Unknown';
}

/** Parses `Country XX` from labels produced by `loginLocationLabel`. */
export function countryFromLoginLocationLabel(label: string): string | null {
  const m = String(label || '').match(/\bCountry\s+([A-Za-z]{2})\b/i);
  return m ? m[1].toUpperCase() : null;
}

export function ipBaselineChanged(stored: string | null | undefined, current: string): boolean {
  const c = String(current || '').trim();
  if (!c) return false;
  const s = String(stored ?? '').trim();
  if (!s) return false;
  return s !== c;
}

/** True when country differs, or full label differs if country tokens are missing. */
export function locationBaselineChanged(stored: string | null | undefined, current: string): boolean {
  const sc = countryFromLoginLocationLabel(String(stored || ''));
  const cc = countryFromLoginLocationLabel(String(current || ''));
  if (sc && cc) return sc !== cc;
  const s = String(stored ?? '').trim();
  const cu = String(current || '').trim();
  if (!s || !cu) return false;
  return s !== cu;
}
