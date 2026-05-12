import { logger } from '../utils/logger';
import { incidentService } from '../services/incident.service';

export type IssueType =
  | 'PRISMA_DB'
  | 'REDIS'
  | 'OPENAI'
  | 'AUTH'
  | 'PERFORMANCE'
  | 'UNKNOWN';

export type AiBrainOutput = {
  issueType: IssueType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedFix: string;
};

function classifyByMessage(message: string): { issueType: IssueType; severity: 'LOW' | 'MEDIUM' | 'HIGH' } {
  const m = message.toLowerCase();
  if (m.includes('p2024') || m.includes('connection pool') || m.includes('prisma')) return { issueType: 'PRISMA_DB', severity: 'HIGH' };
  if (m.includes('redis') || m.includes('ioredis')) return { issueType: 'REDIS', severity: 'MEDIUM' };
  if (m.includes('openai') || m.includes('rate limit') || m.includes('429')) return { issueType: 'OPENAI', severity: 'MEDIUM' };
  if (m.includes('unauthorized') || m.includes('forbidden') || m.includes('jwt')) return { issueType: 'AUTH', severity: 'MEDIUM' };
  if (m.includes('timeout') || m.includes('slow') || m.includes('took')) return { issueType: 'PERFORMANCE', severity: 'MEDIUM' };
  return { issueType: 'UNKNOWN', severity: 'LOW' };
}

/**
 * AI brain v1:
 * - Classifies incidents deterministically (safe).
 * - Optionally enriches with LLM suggestion (LangChain/OpenAI) when enabled.
 *
 * NOTE: We keep this isolated so existing business logic isn't touched.
 */
export const aiBrainService = {
  async ingestSentryEvent(payload: any) {
    const message =
      String(payload?.message || payload?.title || payload?.exception?.values?.[0]?.value || payload?.event_id || 'Sentry event').trim();
    const { issueType, severity } = classifyByMessage(message);

    const incident = await incidentService.create({
      errorCode: `SENTRY_${issueType}`,
      summary: message.slice(0, 500),
      severity,
      source: 'sentry',
      metadata: {
        issueType,
        sentryEventId: payload?.event_id,
        project: payload?.project,
        environment: payload?.environment,
        culprit: payload?.culprit,
      },
    });

    const suggestion = await this.analyzeRootCause({
      message,
      issueType,
      context: { source: 'sentry', sentryEventId: payload?.event_id },
    });

    if (suggestion?.suggestedFix) {
      await incidentService.attachSuggestion(incident.id, suggestion.suggestedFix);
    }

    return { incident, analysis: suggestion };
  },

  async analyzeRootCause(args: { message: string; issueType: IssueType; context?: Record<string, unknown> }): Promise<AiBrainOutput> {
    // Safe deterministic base suggestion.
    const base: AiBrainOutput = {
      issueType: args.issueType,
      severity: classifyByMessage(args.message).severity,
      suggestedFix:
        args.issueType === 'PRISMA_DB'
          ? 'Check DB connectivity/pool settings; reduce parallel Prisma queries; confirm pgbouncer mode and connection_limit.'
          : args.issueType === 'REDIS'
            ? 'Check REDIS_URL connectivity; ensure shared Redis client; confirm queue/rate-limit stores use persistent connection.'
            : args.issueType === 'OPENAI'
              ? 'Check OPENAI_API_KEY, rate limits, and enable circuit breaker; fall back to heuristic mode when OpenAI fails.'
              : args.issueType === 'AUTH'
                ? 'Verify JWT secrets, token payload tenant claims (companyId), and auth middleware ordering.'
                : args.issueType === 'PERFORMANCE'
                  ? 'Inspect slow steps; enable per-query timings; add caching; ensure limits/selects on heavy queries.'
                  : 'Collect more context (route, stack, dependency) and re-run classification.',
    };

    // Optional LLM enrichment (no hard dependency yet).
    const useLLM = String(process.env.SELF_HEALING_LLM_ENABLED || 'false').toLowerCase() === 'true';
    if (!useLLM) return base;

    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');
      const model = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
      });
      const prompt = [
        new SystemMessage(
          'You are an on-call SRE for an ERP. Provide safe, minimal, non-destructive remediation suggestions. ' +
            'Never suggest deleting data. Prefer retries, circuit breakers, and configuration validation.'
        ),
        new HumanMessage(
          `Incident message:\n${args.message}\n\nClassification: ${args.issueType}\n\nContext:\n${JSON.stringify(args.context || {}, null, 2)}\n\n` +
            `Return 3 bullet points: root cause hypothesis, safest mitigation now, next debugging step.`
        ),
      ];
      const res = await model.invoke(prompt);
      const text = String((res as any)?.content || '').trim();
      if (text) {
        return { ...base, suggestedFix: text };
      }
    } catch (err) {
      logger.warn({ err }, '[aiBrain] LLM enrichment failed; using base suggestion');
    }

    return base;
  },
};

