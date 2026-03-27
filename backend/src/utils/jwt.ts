import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET || 'fusiku-erp-secret-key-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';

export interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName?: string;
  /** Omitted for platform-only accounts (rare); tenant users always have this. */
  companyId?: string;
  branchId?: string;
  /** True when role is SYSTEM_ADMIN / SystemAdmin — Prisma tenant middleware is bypassed. */
  isSystemAdmin?: boolean;
}

const signOptions: SignOptions = { expiresIn: JWT_EXPIRES as SignOptions['expiresIn'] };
const refreshSignOptions: SignOptions = { expiresIn: JWT_REFRESH_EXPIRES as SignOptions['expiresIn'] };

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, signOptions);
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, refreshSignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}
