/**
 * Cloud API bridge — extend with your hosted ERP URL + auth.
 * Offline backend stays canonical; cloud receives pushed mutations when online.
 */
const base = () => (process.env.CLOUD_API_BASE_URL || '').replace(/\/$/, '');

export async function cloudHealth(): Promise<boolean> {
  const b = base();
  if (!b) return false;
  try {
    const res = await fetch(`${b}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function cloudPushBatch(body: unknown): Promise<{ ok: boolean; status?: number }> {
  const b = base();
  if (!b) return { ok: false };
  try {
    const res = await fetch(`${b}/api/v1/sync/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CLOUD_API_KEY ? { 'X-API-Key': process.env.CLOUD_API_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}
