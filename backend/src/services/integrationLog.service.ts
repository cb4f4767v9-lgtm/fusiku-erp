/**
 * Integration log service - track external API/webhook calls
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { prisma } from '../utils/prisma';

export const integrationLogService = {
  async log(params: {
    companyId?: string | null;
    integrationType: string;
    requestPayload?: object;
    responseStatus?: number;
    responseBody?: string;
    errorMessage?: string;
  }) {
    return prisma.integrationLog.create({
      data: {
        companyId: params.companyId,
        integrationType: params.integrationType,
        requestPayload: params.requestPayload as any,
        responseStatus: params.responseStatus,
        responseBody: params.responseBody?.slice(0, 2000),
        errorMessage: params.errorMessage
      }
    });
  },

  async list(companyId: string | null, limit = 50) {
    const where = companyId ? { companyId } : {};
    return prisma.integrationLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }
};
