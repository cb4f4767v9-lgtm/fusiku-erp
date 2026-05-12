import { logger } from '../utils/logger';
import { aiContextEngine } from '../aiBusiness/aiContextEngine';
import type { AiContextSnapshot } from '../aiBusiness/aiBusiness.types';
import { confidenceEngine } from '../aiBusiness/confidenceEngine';
import { aiMemory } from '../aiBusiness/aiMemory';
import { openAiChatJsonWithCircuitBreaker } from '../selfHealing/openaiCircuit';
import { trace, SpanStatusCode } from '@opentelemetry/api';

function clampQuestion(q: string) {
  const s = String(q || '').trim();
  return s.length > 600 ? s.slice(0, 600) : s;
}

async function callOpenAIJson(prompt: string): Promise<Pick<AiAskResponse, 'answer' | 'insights' | 'alerts'> | null> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;
  const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();

  try {
    const tracer = trace.getTracer('fusiku.external');
    const span = tracer.startSpan('openai.chat_json', {
      attributes: {
        'ai.provider': 'openai',
        'ai.model': model,
        'ai.purpose': 'ai.ask',
      },
    });
    const data = await openAiChatJsonWithCircuitBreaker({
      purpose: 'ai.ask',
      model,
      temperature: 0.2,
      responseFormatJson: true,
      messages: [
        {
          role: 'system',
          content:
            'You are a business assistant for an ERP. Answer using ONLY the provided data. ' +
            'If the data is insufficient, say what is missing and propose the next best check. ' +
            'Return STRICT JSON: { "answer": string, "insights": string[], "alerts": string[] }.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;
    const parsed = JSON.parse(content) as any;
    if (!parsed || typeof parsed !== 'object') return null;
    const answer = String(parsed.answer || '').trim();
    const insights = Array.isArray(parsed.insights) ? parsed.insights.map((x: any) => String(x)).filter(Boolean) : [];
    const alerts = Array.isArray(parsed.alerts) ? parsed.alerts.map((x: any) => String(x)).filter(Boolean) : [];
    if (!answer) return null;
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return { answer, insights, alerts };
  } catch (err) {
    try {
      const tracer = trace.getTracer('fusiku.external');
      const span = tracer.startSpan('openai.chat_json.error');
      span.recordException(err as any);
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    } catch {
      // ignore
    }
    logger.warn({ err }, '[ai] openai call failed');
    return null;
  }
}

export type AiAskResponse = {
  answer: string;
  dataUsed: {
    context: AiContextSnapshot;
    sources: string[];
    generatedAt: string;
  };
  confidence: number; // 0..1
  insights: string[];
  alerts: string[];
  mode: 'openai' | 'heuristic';
};

function heuristicAnswer(question: string, ctx: AiContextSnapshot): Pick<AiAskResponse, 'answer' | 'insights' | 'alerts'> {
  const q = question.toLowerCase();
  const insights: string[] = [];
  const alerts: string[] = [];

  if (ctx.dataQuality?.warnings?.length) {
    alerts.push(...ctx.dataQuality.warnings.map((w) => `Data quality warning: ${w}`));
  }

  // Core KPIs
  insights.push(
    `Sales today: ${ctx.salesToday.currency} ${ctx.salesToday.total.toFixed(0)} from ${ctx.salesToday.count} sales ` +
      `(profit ${ctx.salesToday.currency} ${ctx.salesToday.profit.toFixed(0)}).`
  );
  insights.push(
    `Month-to-date profit: ${ctx.profitMonth.currency} ${ctx.profitMonth.amount.toFixed(0)}. ` +
      `Month-to-date expenses: ${ctx.expensesMonth.currency} ${ctx.expensesMonth.amount.toFixed(0)}.`
  );
  insights.push(`Inventory available: ${ctx.inventorySummary.availableCount}.`);

  if (ctx.topSellingItems.length) {
    const top = ctx.topSellingItems[0];
    insights.push(`Top selling item today: ${top.brand} ${top.model} (${top.count} sold).`);
  }

  if (ctx.inventorySummary.lowStockModels.length) {
    const topLow = ctx.inventorySummary.lowStockModels[0];
    alerts.push(`Low stock risk: ${topLow.brand} ${topLow.model} has only ${topLow.count} available units.`);
  }

  if (ctx.currencyImpact.movers.length) {
    const m = ctx.currencyImpact.movers[0];
    if ((m.changePct ?? 0) !== 0) {
      insights.push(`Largest FX move: ${m.code} ${m.changePct?.toFixed(2)}% (current ${m.currentRate}).`);
    }
  }

  if (q.includes('profit') && ctx.salesToday.profit <= 0 && ctx.salesToday.total > 0) {
    alerts.push('Profit is low today despite sales — check discounts, cost basis method, and high-cost items sold.');
  }

  let answer = 'Here’s what I can conclude from today’s ERP snapshot.';
  if (q.includes('weak') || q.includes('branch')) {
    const worst = [...ctx.branchStats].sort((a, b) => a.profit - b.profit)[0];
    if (worst) {
      answer =
        `Branch performance: the weakest by profit today is ${worst.branchName} (` +
        `profit ${worst.currency} ${worst.profit.toFixed(0)} on ${worst.currency} ${worst.salesTotal.toFixed(0)} sales).`;
    }
  } else if (q.includes('best') || q.includes('product') || q.includes('top')) {
    const top = ctx.topSellingItems[0];
    answer = top ? `Best performer today is ${top.brand} ${top.model} (${top.count} sold).` : answer;
  } else if (q.includes('why') && q.includes('profit')) {
    answer =
      `Profit month-to-date is ${ctx.profitMonth.currency} ${ctx.profitMonth.amount.toFixed(0)} with expenses ` +
      `${ctx.expensesMonth.currency} ${ctx.expensesMonth.amount.toFixed(0)}. ` +
      `Today’s profit is ${ctx.salesToday.currency} ${ctx.salesToday.profit.toFixed(0)} on ` +
      `${ctx.salesToday.currency} ${ctx.salesToday.total.toFixed(0)} sales. ` +
      `If this feels low, check (1) item-level margins, (2) refunds/voids, (3) whether costs were recorded in USD fields for older sales.`;
  }

  return { answer, insights, alerts };
}

export const aiService = {
  async askAI(
    companyId: string,
    userId: string,
    questionRaw: string,
    opts?: { branchId?: string }
  ): Promise<AiAskResponse> {
    const question = clampQuestion(questionRaw);
    const scopeBranchId = opts?.branchId ? String(opts.branchId).trim() : '';
    const branchId = scopeBranchId ? scopeBranchId : null;

    aiMemory.addQuestion(companyId, question);

    const context = await aiContextEngine.build({ companyId, branchId, days: 30 });
    const conf = confidenceEngine.compute(context);

    const dqWarnings = context.dataQuality?.warnings?.length ? `\n\nDATA QUALITY WARNINGS:\n- ${context.dataQuality.warnings.join('\n- ')}\n` : '\n\nDATA QUALITY WARNINGS:\n- none\n';
    const mem = aiMemory.get(companyId);
    const memoryBlock =
      `\n\nMEMORY (last questions, newest last):\n` +
      JSON.stringify(mem.questions.slice(-20)) +
      `\n\nMEMORY (last insights batches, newest last):\n` +
      JSON.stringify(mem.lastInsights.slice(-5));

    const prompt =
      `Question: ${question}\n\n` +
      `DATA (summary JSON, use only this):\n` +
      JSON.stringify(context) +
      dqWarnings +
      memoryBlock +
      `\n\nReturn STRICT JSON: { "answer": string, "insights": string[], "alerts": string[] }.`;

    const fromOpenAi = await callOpenAIJson(prompt);
    if (fromOpenAi) {
      return {
        ...fromOpenAi,
        mode: 'openai',
        confidence: conf.overall,
        dataUsed: {
          context,
          sources: ['Sale', 'SaleItem', 'Inventory', 'Expense', 'Branch', 'Currency', 'CompanySettings'],
          generatedAt: context.generatedAt,
        },
      };
    }

    const heur = heuristicAnswer(question, context);
    logger.info({ companyId, userId }, '[ai] answered with heuristic mode (OPENAI_API_KEY missing or failed)');
    return {
      ...heur,
      mode: 'heuristic',
      confidence: Math.max(0.25, conf.overall - 0.1),
      dataUsed: {
        context,
        sources: ['Sale', 'SaleItem', 'Inventory', 'Expense', 'Branch', 'Currency', 'CompanySettings'],
        generatedAt: context.generatedAt,
      },
    };
  },
};

