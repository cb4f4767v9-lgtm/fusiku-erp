/**
 * Strict email validation (rejects double dots, missing @, etc.)
 */
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
  // Domain must have at least one dot (TLD)
  if (!domain.includes('.')) return false;
  // Labels: alphanumeric + hyphen, not starting/ending with hyphen
  const labels = domain.split('.');
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }
  // Local part: common safe subset
  if (!/^[a-zA-Z0-9._%+-]+$/.test(local)) return false;
  return true;
}

/** bcrypt hashes are typically 60 chars: $2a$10$... */
export function isBcryptHash(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

export function assertValidSetupPassword(password: string): void {
  if (!password || typeof password !== 'string') throw new Error('Password is required');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');
  if (password.length > 128) throw new Error('Password is too long');
}
