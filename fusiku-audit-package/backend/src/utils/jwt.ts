import jwt from 'jsonwebtoken';

const JWT_EXPIRES = process.env.JWT_EXPIRES || '15m';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';

function requireSecret(name: 'JWT_SECRET' | 'REFRESH_SECRET'): string {
  const v = String(process.env[name] ?? '').trim();
  if (v.length < 32) {
    throw new Error(`${name} must be set and at least 32 characters`);
  }
  return v;
}

function accessSecret(): string {
  return requireSecret('JWT_SECRET');
}

function refreshSecret(): string {
  return requireSecret('REFRESH_SECRET');
}

export interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName?: string;
  /**
   * Branch isolation role (Phase 1). Optional for backward compatibility with older tokens.
   * SUPER_ADMIN: can access all branches within tenant.
   * BRANCH_ADMIN / BRANCH_USER: restricted to branchId.
   */
  branchRole?: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER';
  /** Tenant company (null for platform-only admins without an active tenant claim). */
  companyId?: string | null;
  /** Assigned branch, or null for company-wide / head-office users (dashboard + reports allow this). */
  branchId?: string | null;
  isSystemAdmin?: boolean;
  /** JWT claim — access vs refresh */
  typ?: 'access' | 'refresh';
}

function stripTyp<T extends Record<string, unknown>>(p: T): Omit<T, 'typ'> {
  const { typ: _ignored, ...rest } = p;
  return rest as Omit<T, 'typ'>;
}

export function generateToken(payload: TokenPayload): string {
  const body = stripTyp(payload as unknown as Record<string, unknown>);
  return jwt.sign({ ...body, typ: 'access' }, accessSecret(), {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  const body = stripTyp(payload as unknown as Record<string, unknown>);
  return jwt.sign({ ...body, typ: 'refresh' }, refreshSecret(), {
    algorithm: 'HS256',
    expiresIn: JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, accessSecret(), {
    algorithms: ['HS256'],
    clockTolerance: 5,
  });

  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Invalid token payload');
  }

  const o = decoded as Record<string, unknown>;
  if (o.typ === 'refresh') {
    throw new Error('Invalid token type');
  }
  if (o.typ !== undefined && o.typ !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, refreshSecret(), {
    algorithms: ['HS256'],
    clockTolerance: 5,
  });

  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Invalid refresh token payload');
  }

  const o = decoded as Record<string, unknown>;
  if (o.typ !== 'refresh') {
    throw new Error('Invalid refresh token');
  }

  return decoded as TokenPayload;
}
