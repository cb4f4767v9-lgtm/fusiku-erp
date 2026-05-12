/** Strip placeholder / garbage labels; prefer showing nothing over dummy text. */
const DUMMY_PATTERN = /dasdas/i;

export function sanitizeDisplayLabel(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (DUMMY_PATTERN.test(s)) return '';
  return s;
}
