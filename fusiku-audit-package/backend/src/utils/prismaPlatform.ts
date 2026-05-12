/**
 * Prisma client without tenant $use middleware — platform / auth / bootstrap only.
 * Never import from route handlers that serve tenant users.
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const globalForPrismaPlatform = globalThis as unknown as { prismaPlatform?: PrismaClient };

export const prismaPlatform = globalForPrismaPlatform.prismaPlatform ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaPlatform.prismaPlatform = prismaPlatform;
}
