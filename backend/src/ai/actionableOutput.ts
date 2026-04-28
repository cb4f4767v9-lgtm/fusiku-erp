import type { AIActionableOutput, SmartInsight } from '../aiBusiness/aiBusiness.types';

function normalizePriority(p: unknown): 'low' | 'medium' | 'high' {
  const s = String(p || '').toLowerCase();
  if (s === 'low' || s === 'high' || s === 'medium') return s;
  return 'medium';
}

export function toActionable(partial: Partial<AIActionableOutput> & { message?: string }): AIActionableOutput {
  return {
    action: partial.action ?? 'review',
    target: partial.target ?? 'general',
    value: typeof partial.value === 'number' && Number.isFinite(partial.value) ? partial.value : 0,
    priority: normalizePriority(partial.priority),
  };
}

export function insightsToActionables(insights: SmartInsight[]): AIActionableOutput[] {
  return insights.map((i) =>
    toActionable({
      action: i.recommendation || i.code,
      target: i.title || String(i.code),
      value: typeof i.actions?.[0]?.value === 'number' ? i.actions[0].value : 0,
      priority:
        i.severity === 'warning' ? 'high' : i.severity === 'success' ? 'low' : ('medium' as const),
    })
  );
}

export function mapAlertToActionable(a: {
  type?: string;
  title?: string;
  message?: string;
  severity?: string;
}): AIActionableOutput {
  return toActionable({
    action: a.message || a.title || 'review_alert',
    target: a.title || a.type || 'alert',
    value: 0,
    priority: a.severity === 'warning' ? 'high' : a.severity === 'success' ? 'low' : 'medium',
  });
}

export function buildActionablesFromEngineParts(input: {
  insights: SmartInsight[];
  alerts: any[];
  ownerActions?: Array<{ label: string; type: string; value?: number }>;
}): AIActionableOutput[] {
  const fromInsights = insightsToActionables(input.insights);
  const fromAlerts = (input.alerts || []).slice(0, 20).map((a) => mapAlertToActionable(a));
  const fromOwner = (input.ownerActions || []).map((a) =>
    toActionable({
      action: a.label,
      target: a.type,
      value: typeof a.value === 'number' ? a.value : 0,
      priority: 'medium',
    })
  );
  return [...fromInsights, ...fromAlerts, ...fromOwner];
}
