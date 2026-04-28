import { prisma } from '../utils/prisma';
import { getTenantContext } from '../utils/tenantContext';

type AuditMetadata = Record<string, unknown> | null | undefined;

export const auditLogService = {
  async log(input: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    branchId?: string | null;
    metadata?: AuditMetadata;
  }) {
    const ctx = getTenantContext();
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    return prisma.auditLog.create({
      data: {
        userId: input.userId ?? ctx?.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        branchId: input.branchId ?? ctx?.branchId ?? null,
        metadata,
      } as any,
    } as any);
  },
};

