/** Wall-clock deadline (ms since epoch) after which offline use requires reconnecting. */
const OFFLINE_LICENSE_UNTIL_KEY = 'fusiku_offline_license_until_ms';

export function getOfflineLicenseDays(): number {
  try {
    const raw = String(import.meta.env.VITE_OFFLINE_LICENSE_DAYS ?? '').trim();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.min(365, Math.max(1, Math.floor(n)));
  } catch {
    /* ignore */
  }
  return 7;
}

/** Call after a successful online authentication or profile sync. */
export function refreshOfflineLicenseDeadline(): void {
  try {
    const days = getOfflineLicenseDays();
    const until = Date.now() + days * 86_400_000;
    localStorage.setItem(OFFLINE_LICENSE_UNTIL_KEY, String(until));
  } catch {
    /* ignore */
  }
}

export function clearOfflineLicenseDeadline(): void {
  try {
    localStorage.removeItem(OFFLINE_LICENSE_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

function readDeadlineMs(): number | null {
  try {
    const raw = localStorage.getItem(OFFLINE_LICENSE_UNTIL_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** True when the stored deadline exists and is in the past. */
export function isOfflineLicenseExpired(): boolean {
  const until = readDeadlineMs();
  if (until === null) return false;
  return Date.now() > until;
}

export function hasOfflineLicenseDeadline(): boolean {
  return readDeadlineMs() !== null;
}
