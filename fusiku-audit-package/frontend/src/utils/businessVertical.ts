import type { AuthUser } from '../hooks/useAuth';
import { isSuperAdmin } from './permissions';

/** Coarse vertical derived from company onboarding / tenant profile (additive — unknown → general). */
export type BusinessVertical =
  | 'general'
  | 'institute'
  | 'mobile_retail'
  | 'repair_focused'
  | 'parts'
  | 'accessories'
  | 'sourcing';

export function resolveBusinessVertical(companyBusinessType: string | null | undefined): BusinessVertical {
  const s = String(companyBusinessType || '').toLowerCase();
  if (!s.trim()) return 'general';
  if (s.includes('institute')) return 'institute';
  if (s.includes('repair')) return 'repair_focused';
  if (s.includes('parts')) return 'parts';
  if (s.includes('accessories')) return 'accessories';
  if (s.includes('sourcing')) return 'sourcing';
  if (s.includes('mobile') || s.includes('shop')) {
    return 'mobile_retail';
  }
  return 'general';
}

export function effectiveVerticalForUser(user: AuthUser | null | undefined): BusinessVertical {
  if (!user) return 'general';
  return resolveBusinessVertical(user.companyBusinessType);
}

function verticalsForUser(user: AuthUser | null | undefined): BusinessVertical[] {
  if (!user) return ['general'];
  const raw =
    Array.isArray(user.companyBusinessTypes) && user.companyBusinessTypes.length
      ? user.companyBusinessTypes
      : user.companyBusinessType
        ? [user.companyBusinessType]
        : [];

  const out = new Set<BusinessVertical>();
  out.add('general');
  for (const r of raw) {
    const s = String(r || '').toLowerCase();
    if (!s.trim()) continue;
    if (s.includes('institute')) out.add('institute');
    if (s.includes('repair')) out.add('repair_focused');
    if (s.includes('sourcing')) out.add('sourcing');
    if (s.includes('parts')) out.add('parts');
    if (s.includes('accessories')) out.add('accessories');
    if (s.includes('mobile') || s.includes('shop')) out.add('mobile_retail');
  }
  return Array.from(out);
}

export function sidebarItemVisibleForVertical(
  user: AuthUser | null | undefined,
  opts: {
    onlyForVerticals?: BusinessVertical[];
    hideForVerticals?: BusinessVertical[];
  }
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  const vs = verticalsForUser(user);

  if (opts.onlyForVerticals?.length) {
    const ok = opts.onlyForVerticals.some((v) => vs.includes(v));
    if (!ok) return false;
  }

  if (opts.hideForVerticals?.length) {
    const hidden = opts.hideForVerticals.some((v) => vs.includes(v));
    if (hidden) return false;
  }

  return true;
}
