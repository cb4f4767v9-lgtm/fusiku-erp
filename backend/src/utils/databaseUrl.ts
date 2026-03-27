/**
 * Single source of truth for logging: process.env.DATABASE_URL after .env load.
 */
export function getActiveDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export function describeDatabaseUrl(url: string | undefined): {
  kind: 'sqlite' | 'postgres' | 'mysql' | 'unknown';
  safeLog: string;
} {
  if (!url) return { kind: 'unknown', safeLog: '(not set)' };
  const lower = url.toLowerCase();
  if (lower.startsWith('file:')) {
    const pathPart = url.replace(/^file:/i, '').split('?')[0];
    return { kind: 'sqlite', safeLog: `sqlite file:${pathPart}` };
  }
  if (lower.startsWith('postgresql:') || lower.startsWith('postgres:')) {
    return { kind: 'postgres', safeLog: redactConnectionString(url) };
  }
  if (lower.startsWith('mysql:')) {
    return { kind: 'mysql', safeLog: redactConnectionString(url) };
  }
  return { kind: 'unknown', safeLog: redactConnectionString(url) };
}

export function redactConnectionString(url: string): string {
  return url.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://$1:***@');
}
