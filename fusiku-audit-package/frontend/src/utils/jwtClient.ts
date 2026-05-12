export type JwtPayloadLite = {
  companyId?: string;
  branchId?: string;
  branchRole?: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER';
  isSystemAdmin?: boolean;
  [k: string]: unknown;
};

function b64UrlDecode(input: string): string {
  const s = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  // atob exists in browsers; fall back for older envs.
  if (typeof atob === 'function') return atob(s + pad);
  // eslint-disable-next-line no-undef
  return Buffer.from(s + pad, 'base64').toString('utf-8');
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayloadLite | null {
  try {
    const t = String(token || '').trim();
    if (!t) return null;
    const parts = t.split('.');
    if (parts.length < 2) return null;
    const json = b64UrlDecode(parts[1]);
    const obj = JSON.parse(json) as JwtPayloadLite;
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch {
    return null;
  }
}

export function getSessionBranchScope(token: string | null | undefined): {
  branchId: string | null;
  branchRole: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER' | null;
  isSystemAdmin: boolean;
} {
  const p = decodeJwtPayload(token);
  const branchId = p?.branchId ? String(p.branchId).trim() : '';
  const role =
    p?.branchRole === 'SUPER_ADMIN' || p?.branchRole === 'BRANCH_ADMIN' || p?.branchRole === 'BRANCH_USER'
      ? p.branchRole
      : null;
  return {
    branchId: branchId || null,
    branchRole: role,
    isSystemAdmin: p?.isSystemAdmin === true,
  };
}

