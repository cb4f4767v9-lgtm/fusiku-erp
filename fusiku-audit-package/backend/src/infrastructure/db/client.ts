import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { registerTenantMiddleware } from '../../core/tenant/tenantMiddleware';
import { registerPerformanceAndCacheMiddleware } from './performanceAndCache.middleware';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

registerTenantMiddleware(prisma);
registerPerformanceAndCacheMiddleware(prisma);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
