/** Mirrors backend `isValidEmailStrict` — keep rules in sync. */
export function isValidEmailStrict(email: string): boolean {
  const e = String(email || '').trim();
  if (!e || e.length > 254) return false;
  if (e.includes(' ') || e.includes('..')) return false;
  const at = e.indexOf('@');
  if (at <= 0 || at !== e.lastIndexOf('@')) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!local || !domain) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (!domain.includes('.')) return false;
  const labels = domain.split('.');
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }
  if (!/^[a-zA-Z0-9._%+-]+$/.test(local)) return false;
  return true;
}
