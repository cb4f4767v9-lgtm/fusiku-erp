import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

type IncidentRow = {
  id: string;
  companyId?: string | null;
  errorCode: string;
  summary: string;
  severity: string;
  status: string;
  aiSuggestion?: string | null;
  source: string;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export const incidentService = {
  async create(args: {
    companyId?: string | null;
    errorCode: string;
    summary: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    source?: 'system' | 'sentry' | 'manual';
    aiSuggestion?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<IncidentRow> {
    const row = (await (prisma as any).incident.create({
      data: {
        companyId: args.companyId ?? null,
        errorCode: String(args.errorCode || '').trim() || 'UNSPECIFIED',
        summary: String(args.summary || '').trim() || 'No summary',
        severity: args.severity,
        status: 'open',
        aiSuggestion: args.aiSuggestion ?? null,
        source: args.source || 'system',
        metadata: args.metadata || undefined,
      },
    })) as IncidentRow;
    logger.warn({ incidentId: row.id, errorCode: row.errorCode, severity: row.severity }, '[incident] created');
    return row;
  },

  async list(args?: { status?: 'open' | 'resolved'; limit?: number; offset?: number }) {
    const status = args?.status ? String(args.status) : undefined;
    const limit = Math.min(Math.max(Number(args?.limit || 50), 1), 500);
    const offset = Math.max(Number(args?.offset || 0), 0);
    const where: any = {};
    if (status) where.status = status;
    const rows = (await (prisma as any).incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })) as IncidentRow[];
    return rows;
  },

  async setStatus(id: string, status: 'open' | 'resolved') {
    const row = (await (prisma as any).incident.update({
      where: { id },
      data: { status },
    })) as IncidentRow;
    return row;
  },

  async attachSuggestion(id: string, aiSuggestion: string) {
    const row = (await (prisma as any).incident.update({
      where: { id },
      data: { aiSuggestion: String(aiSuggestion || '').trim() },
    })) as IncidentRow;
    return row;
  },
};

