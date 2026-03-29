import jwt from 'jsonwebtoken';

const JWT_SECRET: string =
  process.env.JWT_SECRET || 'fusiku-erp-secret-key-change-in-production';

const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';

export interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName?: string;
  companyId?: string;
  branchId?: string;
  isSystemAdmin?: boolean;
}

function assertPayloadHasTenantWhenRequired(payload: TokenPayload): void {
  if (!payload.isSystemAdmin) {
    if (!payload.companyId || payload.companyId.trim() === '') {
      throw new Error('Tenant isolation violation: companyId missing');
    }
  }
}

export function generateToken(payload: TokenPayload): string {
  assertPayloadHasTenantWhenRequired(payload);
  return jwt.sign(payload as object, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES as any,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  assertPayloadHasTenantWhenRequired(payload);
  return jwt.sign(payload as object, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_REFRESH_EXPIRES as any,
  });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  });

  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Invalid token payload');
  }

  return decoded as TokenPayload;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token);
    return typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)
      ? (decoded as TokenPayload)
      : null;
  } catch {
    return null;
  }
}
