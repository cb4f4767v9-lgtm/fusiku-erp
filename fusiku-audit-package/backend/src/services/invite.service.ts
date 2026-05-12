import jwt, { type SignOptions } from 'jsonwebtoken';

export type InviteClaims = {
  email: string;
  companyId: string;
  roleId: string;
  branchId?: string;
};

function secret(): string {
  const s = String(process.env.INVITE_TOKEN_SECRET || '').trim();
  if (!s || s.length < 16) {
    throw new Error('Invite tokens not configured (missing INVITE_TOKEN_SECRET, min 16 chars)');
  }
  return s;
}

export const inviteService = {
  signInvite(claims: InviteClaims, opts?: { expiresIn?: string }) {
    const exp = opts?.expiresIn || '7d';
    return jwt.sign(claims, secret(), { expiresIn: exp } as SignOptions);
  },

  verifyInvite(token: string): InviteClaims {
    const decoded = jwt.verify(token, secret());
    if (!decoded || typeof decoded !== 'object') throw new Error('Invalid invite token');
    const o = decoded as any;
    const email = String(o.email || '').trim().toLowerCase();
    const companyId = String(o.companyId || '').trim();
    const roleId = String(o.roleId || '').trim();
    const branchId = o.branchId ? String(o.branchId).trim() : undefined;
    if (!email || !companyId || !roleId) throw new Error('Invalid invite token payload');
    return { email, companyId, roleId, ...(branchId ? { branchId } : {}) };
  },
};

