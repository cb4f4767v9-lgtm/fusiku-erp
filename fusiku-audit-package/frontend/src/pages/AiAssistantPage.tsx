import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { PageLayout, PageHeader } from '../components/design-system';

type AssistantPayload = {
  answer: string;
  confidence?: number;
  dataUsed?: any;
  insights: string[];
  alerts: string[];
  mode?: string;
  context?: any;
};

type ChatMessage =
  | { id: string; role: 'user'; content: string }
  | {
    id: string;
    role: 'assistant';
    content: string;
    insights?: string[];
    alerts?: string[];
    meta?: { mode?: string; confidencePct?: number; dqWarnings?: string[] };
  };

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const suggested = [
  'Show sales',
  'Check profit',
  'Analyze performance',
];

export default function AiAssistantPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: 'assistant',
      content: t('aiAssistant.welcome'),
      insights: [],
      alerts: [],
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: q };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    setInput('');

    try {
      const res = await api.post<AssistantPayload>('/ai/ask', { question: q });
      const data = res.data || ({} as AssistantPayload);

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: String(data.answer || t('aiAssistant.noAnswer')).trim(),
        insights: Array.isArray(data.insights) ? data.insights : [],
        alerts: Array.isArray(data.alerts) ? data.alerts : [],
        meta: {
          mode: data.mode,
          confidencePct: data.confidence != null ? Math.round(Number(data.confidence) * 100) : undefined,
          dqWarnings: Array.isArray(data?.dataUsed?.context?.dataQuality?.warnings) ? data.dataUsed.context.dataQuality.warnings : [],
        },
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (e: unknown) {
      const detail = getErrorMessage(e, '').trim();
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: t('aiAssistant.failed'),
        insights: [],
        alerts: detail ? [detail] : [],
      };
      setMessages((m) => [...m, assistantMsg]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout className="page">
      <PageHeader title={t('aiAssistant.title')} subtitle={t('aiAssistant.subtitle')} />

      <div className="card ai-assistant-card">
        <div className="ai-assistant-suggestions">
          {suggested.map((q) => (
            <button
              key={q}
              className="btn btn-secondary btn-erp"
              disabled={loading}
              onClick={() => void ask(q)}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="ai-assistant-thread">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className={`ai-assistant-row ${isUser ? 'ai-assistant-row--user' : 'ai-assistant-row--assistant'}`}>
                <div className={`ai-assistant-bubble ${isUser ? 'ai-assistant-bubble--user' : 'ai-assistant-bubble--assistant'}`}>
                  <div className="ai-assistant-content">{m.content}</div>

                  {!isUser && (m.alerts?.length || m.insights?.length) ? (
                    <div className="ai-assistant-meta-stack">
                      {m.meta?.confidencePct != null ? (
                        <div className="ai-assistant-confidence">
                          <div className="ai-assistant-meta-label">Confidence</div>
                          <div className="ai-assistant-confidence-bar">
                            <div
                              className={`ai-assistant-confidence-fill ${
                                m.meta.confidencePct >= 70
                                  ? 'ai-assistant-confidence-fill--high'
                                  : m.meta.confidencePct >= 45
                                    ? 'ai-assistant-confidence-fill--medium'
                                    : 'ai-assistant-confidence-fill--low'
                              }`}
                              style={{ width: `${m.meta.confidencePct}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      {m.meta?.dqWarnings && m.meta.dqWarnings.length > 0 ? (
                        <div className="ai-assistant-panel ai-assistant-panel--warning">
                          <div className="ai-assistant-panel-title ai-assistant-panel-title--warning">Data quality warnings</div>
                          <ul className="ai-assistant-list">
                            {m.meta.dqWarnings.map((w, idx) => (
                              <li key={idx}>
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {m.alerts && m.alerts.length > 0 ? (
                        <div className="ai-assistant-panel ai-assistant-panel--error">
                          <div className="ai-assistant-panel-title ai-assistant-panel-title--error">{t('aiAssistant.alerts')}</div>
                          <ul className="ai-assistant-list">
                            {m.alerts.map((a, idx) => (
                              <li key={idx}>
                                {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {m.insights && m.insights.length > 0 ? (
                        <div className="ai-assistant-panel ai-assistant-panel--success">
                          <div className="ai-assistant-panel-title">{t('aiAssistant.insights')}</div>
                          <ul className="ai-assistant-list">
                            {m.insights.map((a, idx) => (
                              <li key={idx}>
                                {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {m.meta?.mode ? (
                        <div className="ai-assistant-meta-line">
                          {t('aiAssistant.mode')}: {m.meta.mode}
                        </div>
                      ) : null}
                      {m.meta?.confidencePct != null ? (
                        <div className="ai-assistant-meta-line">
                          Confidence: {m.meta.confidencePct}%
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {loading ? (
            <div className="ai-assistant-thinking">{t('aiAssistant.thinking')}</div>
          ) : null}
        </div>

        <div className="ai-assistant-input-row">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('aiAssistant.placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) void ask(input);
              }
            }}
            disabled={loading}
          />
          <button className="btn btn-primary btn-erp" onClick={() => void ask(input)} disabled={!canSend}>
            {t('aiAssistant.ask')}
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

