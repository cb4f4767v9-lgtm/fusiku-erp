import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Sparkles, ShoppingCart, AlertTriangle, TrendingUp, Wrench, DollarSign, RefreshCw, Target, Bell } from 'lucide-react';
import { api } from '../services/api';
import { useCurrency } from '../contexts/CurrencyContext';
import { PageLayout, PageHeader, ErrorState } from '../components/design-system';
import { DashboardSkeleton } from '../components/PageStates';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/getErrorMessage';

function riskBadge(t: TFunction, riskLevel?: string | null) {
  const level = String(riskLevel || '').toLowerCase();
  const meta =
    level === 'high'
      ? { labelKey: 'ai.risk.high', color: 'var(--error, #ef4444)', bg: 'color-mix(in srgb, var(--error, #ef4444) 12%, transparent)' }
      : level === 'medium'
        ? { labelKey: 'ai.risk.medium', color: 'var(--warning, #f59e0b)', bg: 'color-mix(in srgb, var(--warning, #f59e0b) 12%, transparent)' }
        : { labelKey: 'ai.risk.low', color: 'var(--success, #16a34a)', bg: 'color-mix(in srgb, var(--success, #16a34a) 12%, transparent)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        border: `1px solid color-mix(in srgb, ${meta.color} 35%, var(--border))`,
        background: meta.bg,
        color: meta.color,
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      {t('ai.risk.withLevel', { level: t(meta.labelKey) })}
    </span>
  );
}

export function AIBusinessIntelligencePage() {
  const { t } = useTranslation();
  const { formatMoney, convert, selectedCurrency, ledgerBaseCurrency } = useCurrency();
  const navigate = useNavigate();
  const [engine, setEngine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [simPct, setSimPct] = useState<number>(5);
  const [sim, setSim] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simDebouncedPct, setSimDebouncedPct] = useState<number>(5);

  const money = (n: number) =>
    formatMoney(convert(Number(n || 0), ledgerBaseCurrency, selectedCurrency), selectedCurrency);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    void api
      .get('/ai/business-engine')
      .then((r) => {
        setEngine(r.data ?? null);
        setLoadError(false);
      })
      .catch(() => {
        setEngine(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const ctx = engine?.context;
    return {
      totalSales: Number(ctx?.salesToday?.total ?? 0),
      monthlyProfit: Number(ctx?.profitMonth?.amount ?? 0),
      topModel: ctx?.topSellingItems?.[0] ? `${ctx.topSellingItems[0].brand} ${ctx.topSellingItems[0].model}` : null,
      lowStock: Array.isArray(ctx?.inventorySummary?.lowStockModels) ? ctx.inventorySummary.lowStockModels.length : 0,
      repairsInProgress: 0,
    };
  }, [engine]);

  const cards = [
    { labelKey: 'ai.totalSales', value: money(stats.totalSales ?? 0), icon: ShoppingCart, color: 'var(--primary)' },
    { labelKey: 'ai.monthlyProfit', value: money(stats.monthlyProfit ?? 0), icon: DollarSign, color: '#22c55e' },
    {
      labelKey: 'ai.topModel',
      value: stats.topModel ? stats.topModel : t('common.noData'),
      icon: TrendingUp,
      color: '#a78bfa',
    },
    { labelKey: 'ai.lowStock', value: stats.lowStock ?? 0, icon: AlertTriangle, color: '#f59e0b' },
    { labelKey: 'ai.repairs', value: stats.repairsInProgress ?? 0, icon: Wrench, color: '#94a3b8' },
  ];

  const insights: any[] = Array.isArray(engine?.insights) ? engine.insights : [];
  const forecast = engine?.forecast;
  const alerts: any[] = Array.isArray(engine?.alerts) ? engine.alerts : [];
  const pricing: any[] = Array.isArray(engine?.pricing) ? engine.pricing : [];
  const anomalies: any[] = Array.isArray(engine?.anomalies) ? engine.anomalies : [];
  const riskLevel: string | null = engine?.risk?.riskLevel ?? null;
  const branchStrategy = engine?.branchStrategy;
  const inventoryRisk = engine?.inventoryRisk;
  const ownerInsights = engine?.ownerInsights;
  const overallConfidencePct = engine?.confidence != null ? Math.round(Number(engine.confidence) * 100) : null;
  const dqWarnings: string[] = Array.isArray(engine?.context?.dataQuality?.warnings) ? engine.context.dataQuality.warnings : [];
  const traceBasedOn: string[] = Array.isArray(engine?.trace?.basedOn) ? engine.trace.basedOn : [];
  const dataHealthScore: number | null = engine?.dataHealth?.score != null ? Number(engine.dataHealth.score) : null;

  const confidenceColor =
    overallConfidencePct == null
      ? 'var(--text-secondary)'
      : overallConfidencePct >= 70
        ? 'var(--success, #16a34a)'
        : overallConfidencePct >= 45
          ? 'var(--warning, #f59e0b)'
          : 'var(--error, #ef4444)';

  const runSim = useCallback(async () => {
    setSimLoading(true);
    try {
      const res = await api.post('/ai/simulate', { priceIncreasePct: simDebouncedPct });
      setSim(res.data ?? null);
    } catch (e: any) {
      setSim(null);
      toast.error(getErrorMessage(e, 'Simulation failed'));
    } finally {
      setSimLoading(false);
    }
  }, [simDebouncedPct]);

  // Debounce simulation input to avoid excessive requests while typing.
  useEffect(() => {
    const t = window.setTimeout(() => setSimDebouncedPct(simPct), 650);
    return () => window.clearTimeout(t);
  }, [simPct]);

  useEffect(() => {
    // Auto-run when debounced value changes (keeps UX “interactive”).
    if (loading || loadError || !engine) return;
    void runSim();
  }, [engine, loadError, loading, runSim, simDebouncedPct]);

  const execAction = async (action: any, ctx?: any) => {
    const type = String(action?.type || '');
    if (type === 'review_expenses') {
      navigate('/expenses');
      return;
    }
    if (type === 'transfer_stock') {
      const ok = window.confirm('Create a transfer draft? You can review and submit on the Transfers page.');
      if (!ok) return;
      navigate('/transfers');
      return;
    }
    if (type === 'discount_pct' || type === 'adjust_price_pct') {
      // Executable "apply" requires inventoryId + currentPrice; if missing, we guide user.
      const inventoryId = ctx?.inventoryId || action?.inventoryId;
      const currentPrice = Number(ctx?.currentPrice ?? action?.currentPrice);
      const pct = Number(action?.value ?? action?.pct);
      if (!inventoryId || !Number.isFinite(currentPrice) || !Number.isFinite(pct)) {
        toast('Select an inventory item to apply pricing.');
        navigate('/inventory');
        return;
      }
      const newPrice = currentPrice * (1 + pct / 100);
      const ok = window.confirm(`Apply price change from ${currentPrice.toFixed(2)} to ${newPrice.toFixed(2)}?`);
      if (!ok) return;
      await api.put(`/inventory/${inventoryId}`, { sellingPrice: newPrice });
      toast.success('Price updated');
      navigate('/inventory');
      return;
    }
    toast('Action not supported yet');
  };

  const ready = !loading && !loadError && !!engine;

  return (
    <PageLayout className="page">
      <PageHeader
        title={
          <>
            <Sparkles size={24} className="ai-page-title-icon" aria-hidden /> {t('ai.title')}
          </>
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {ready && riskLevel ? riskBadge(t, riskLevel) : null}
            <button type="button" className="btn btn-secondary" onClick={load}>
              <RefreshCw size={18} /> {t('common.refresh')}
            </button>
          </div>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : loadError || !engine ? (
        <ErrorState message={t('ai.loadFailed')} onRetry={load} />
      ) : null}

      {/* AI Disclaimer */}
      {ready ? (
        <div
          className="card"
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--warning, #f59e0b) 25%, var(--border))',
            background: 'color-mix(in srgb, var(--warning, #f59e0b) 4%, transparent)',
          }}
        >
        <div style={{ fontWeight: 900, marginBottom: 4, color: 'var(--warning, #f59e0b)' }}>AI disclaimer</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          AI insights and simulations are advisory and may be inaccurate due to missing costs, FX data, or operational context. Always review before executing actions.
        </div>
        </div>
      ) : null}

      {ready && anomalies.length ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid color-mix(in srgb, var(--error, #ef4444) 35%, var(--border))', background: 'color-mix(in srgb, var(--error, #ef4444) 6%, transparent)' }}>
          <div style={{ fontWeight: 900, marginBottom: 6, color: 'var(--error, #ef4444)' }}>Abnormal activity detected</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {anomalies.slice(0, 4).map((a, idx) => (
              <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-1)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>{String(a.title || 'Anomaly')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{String(a.message || '')}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {ready ? (
        <div className="dashboard-kpi-grid">
          {cards.map(({ labelKey, value, icon: Icon, color }) => (
            <div key={labelKey} className="stat-card ai-stat-card" style={{ '--card-accent': color } as CSSProperties}>
              <Icon size={24} style={{ color }} aria-hidden />
              <div>
                <span className="stat-value">{value}</span>
                <span className="stat-label">{t(labelKey)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {dataHealthScore != null ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ fontWeight: 900 }}>Data health score</div>
            <div style={{ fontWeight: 900, color: dataHealthScore >= 80 ? 'var(--success, #16a34a)' : dataHealthScore >= 55 ? 'var(--warning, #f59e0b)' : 'var(--error, #ef4444)' }}>
              {Math.round(dataHealthScore)}/100
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            Computed from legacy cost and missing FX signals. Improve this to increase AI reliability.
          </div>
        </div>
      ) : null}

      {overallConfidencePct != null ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ fontWeight: 900 }}>AI confidence</div>
            <div style={{ fontSize: 12, color: confidenceColor, fontWeight: 900 }}>{overallConfidencePct}%</div>
          </div>
          <div style={{ height: 10, borderRadius: 999, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface-1)', marginTop: 8 }}>
            <div
              style={{
                height: '100%',
                width: `${overallConfidencePct}%`,
                background:
                  overallConfidencePct >= 70 ? 'color-mix(in srgb, var(--success, #16a34a) 70%, transparent)' : overallConfidencePct >= 45
                    ? 'color-mix(in srgb, var(--warning, #f59e0b) 75%, transparent)'
                    : 'color-mix(in srgb, var(--error, #ef4444) 70%, transparent)',
              }}
            />
          </div>
        </div>
      ) : null}

      {dqWarnings.length ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid color-mix(in srgb, var(--warning, #f59e0b) 35%, var(--border))', background: 'color-mix(in srgb, var(--warning, #f59e0b) 6%, transparent)' }}>
          <div style={{ fontWeight: 900, marginBottom: 6, color: 'var(--warning, #f59e0b)' }}>Data quality warnings</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {dqWarnings.map((w, idx) => (
              <li key={idx} style={{ fontSize: 12, color: 'var(--text)' }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Explainability trace */}
      <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontWeight: 900 }}>Trace</div>
          <button type="button" className="btn btn-secondary btn-erp" style={{ fontSize: 12 }} onClick={() => setShowTrace((s) => !s)}>
            {showTrace ? 'Hide' : 'Show'}
          </button>
        </div>
        {showTrace ? (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            Based on: {traceBasedOn.length ? traceBasedOn.join(', ') : '—'}
          </div>
        ) : null}
      </div>

      {/* Simulation */}
      <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Simulation (what-if)</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Disclaimer: This is a simplified “what-if” estimate (short-run costs assumed fixed). Validate on a small subset before rolling out.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>What if price increases by</div>
          <input
            type="number"
            step={0.5}
            min={-50}
            max={50}
            value={simPct}
            onChange={(e) => setSimPct(Number(e.target.value))}
            className="input"
            style={{ width: 110 }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>%</div>
          <button type="button" className="btn btn-primary btn-erp" style={{ fontSize: 12 }} onClick={() => void runSim()} disabled={simLoading}>
            {simLoading ? 'Running…' : 'Run simulation'}
          </button>
        </div>
        {sim ? (
          <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-1)' }}>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Results</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 6 }}>
              <div>
                Baseline profit: <span style={{ fontWeight: 900, color: 'var(--text)' }}>{money(Number(sim?.baseline?.profit || 0))}</span> → New profit:{' '}
                <span style={{ fontWeight: 900, color: 'var(--text)' }}>{money(Number(sim?.simulated?.profit || 0))}</span>
              </div>
              <div>
                Impact: <span style={{ fontWeight: 900, color: 'var(--text)' }}>{money(Number(sim?.impact?.profitDelta || 0))}</span>{' '}
                {sim?.impact?.profitDeltaPct != null ? `(${Number(sim.impact.profitDeltaPct).toFixed(1)}%)` : ''}
              </div>
              <div>Recommendation: {String(sim?.recommendation || '')}</div>
            </div>
          </div>
        ) : null}
      </div>

      {ownerInsights ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 900 }}>Owner-level insights</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {ownerInsights?.mostProfitableBranch?.branchName ? `Most profitable: ${ownerInsights.mostProfitableBranch.branchName}` : ''}
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{String(ownerInsights?.narrative || '')}</div>
          {Array.isArray(ownerInsights?.actions) && ownerInsights.actions.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {ownerInsights.actions.slice(0, 4).map((a: any, idx: number) => (
                <button key={idx} type="button" className="btn btn-primary btn-erp" style={{ fontSize: 12 }} onClick={() => void execAction(a)}>
                  {String(a.label || 'Action')}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {branchStrategy?.transferRecommendations?.length ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Multi-branch strategy</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {branchStrategy.transferRecommendations.slice(0, 4).map((tr: any, idx: number) => (
              <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-1)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>
                  Transfer {String(tr.brand)} {String(tr.model)} ({Number(tr.suggestedUnits || 0)} units)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  From {String(tr.fromBranchName)} → {String(tr.toBranchName)}. {String(tr.reason || '')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary btn-erp" style={{ fontSize: 12 }} onClick={() => void execAction({ type: 'transfer_stock' })}>
                    Create transfer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {inventoryRisk?.deadStock30?.length || inventoryRisk?.deadStock60?.length ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Inventory risk analysis</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {Array.isArray(inventoryRisk?.recommendations) && inventoryRisk.recommendations.length ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-1)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{String(inventoryRisk.recommendations[0]?.message || '')}</div>
                {Array.isArray(inventoryRisk.recommendations[0]?.actions) && inventoryRisk.recommendations[0].actions.length ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {inventoryRisk.recommendations[0].actions.slice(0, 3).map((a: any, idx: number) => (
                      <button key={idx} type="button" className="btn btn-secondary btn-erp" style={{ fontSize: 12 }} onClick={() => void execAction(a)}>
                        {String(a.label || 'Action')}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {Array.isArray(inventoryRisk?.deadStock60) && inventoryRisk.deadStock60.length ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Dead inventory (60+ days): <span style={{ fontWeight: 900, color: 'var(--text)' }}>{inventoryRisk.deadStock60.length}</span>
              </div>
            ) : null}
            {Array.isArray(inventoryRisk?.deadStock30) && inventoryRisk.deadStock30.length ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Slow inventory (30+ days): <span style={{ fontWeight: 900, color: 'var(--text)' }}>{inventoryRisk.deadStock30.length}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
        <div className="card" style={{ padding: 12, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sparkles size={18} aria-hidden />
            <div style={{ fontWeight: 800 }}>{t('ai.insights') || 'Insights'}</div>
          </div>
          {insights.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {insights.slice(0, 6).map((it, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-1)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>{String(it.title || it.code || 'Insight')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 900 }}>Problem:</span> {String(it.problem || it.message || '')}
                    </div>
                    <div>
                      <span style={{ fontWeight: 900 }}>Recommendation:</span> {String(it.recommendation || '')}
                    </div>
                  </div>
                  {Array.isArray(it.actions) && it.actions.length ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {it.actions.slice(0, 3).map((a: any, aIdx: number) => (
                        <button key={aIdx} type="button" className="btn btn-secondary btn-erp" style={{ fontSize: 12 }}>
                          {String(a.label || 'Action')}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.noData')}</div>
          )}
        </div>

        <div className="card" style={{ padding: 12, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Target size={18} aria-hidden />
            <div style={{ fontWeight: 800 }}>{t('ai.forecast') || 'Forecast'}</div>
          </div>
          {forecast ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12 }}>
                <div style={{ color: 'var(--text-secondary)' }}>Next month sales</div>
                <div style={{ fontWeight: 900 }}>{money(Number(forecast.nextMonthSales || 0))}</div>
              </div>
              <div style={{ fontSize: 12 }}>
                <div style={{ color: 'var(--text-secondary)' }}>Expected profit</div>
                <div style={{ fontWeight: 900 }}>{money(Number(forecast.expectedProfit || 0))}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Confidence: {Math.round(Number(forecast.confidence || 0) * 100)}%
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.noData')}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 12, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Bell size={18} aria-hidden />
            <div style={{ fontWeight: 800 }}>{t('ai.alerts') || 'Alerts'}</div>
          </div>
          {alerts.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {alerts.slice(0, 6).map((a, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-1)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>{String(a.title || a.type || 'Alert')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{String(a.message || '')}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.noData')}</div>
          )}
        </div>

        <div className="card" style={{ padding: 12, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <DollarSign size={18} aria-hidden />
            <div style={{ fontWeight: 800 }}>{t('ai.recommendations') || 'Recommendations'}</div>
          </div>
          {pricing.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {pricing.slice(0, 6).map((p, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-1)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>
                    {String(p.brand || '')} {String(p.model || '')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Suggested price: {money(Number(p.suggestedSellingPrice || 0))} · Margin: {Number(p.suggestedMarginPct || 0).toFixed(1)}% ·
                    Confidence: {Math.round(Number(p.confidence || 0) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.noData')}</div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
