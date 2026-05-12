import { useEffect, useMemo, useRef, useState } from 'react';

export type DashboardMiniKpi = {
  labelKey: string;
  value: string | number;
  tone: 'sales' | 'profit' | 'inventory' | 'neutral' | string;
};

function useCountUp(target: number, enabled: boolean) {
  const [v, setV] = useState(0);
  const raf = useRef<number | null>(null);
  const startAtRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setV(target);
      return;
    }
    const start = performance.now();
    startAtRef.current = start;
    fromRef.current = 0;
    const duration = 900;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startAtRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [enabled, target]);

  return v;
}

export function KPISection(props: {
  t: (key: string, opts?: any) => string;
  riskTone: 'ok' | 'warn' | 'danger';
  primaryKpis: DashboardMiniKpi[];
}) {
  const { t, riskTone, primaryKpis } = props;

  const numericTargets = useMemo(
    () =>
      primaryKpis.map((k) => (typeof k.value === 'number' && Number.isFinite(k.value) ? k.value : null)),
    [primaryKpis]
  );

  const n0 = useCountUp(numericTargets[0] ?? 0, numericTargets[0] != null);
  const n1 = useCountUp(numericTargets[1] ?? 0, numericTargets[1] != null);
  const n2 = useCountUp(numericTargets[2] ?? 0, numericTargets[2] != null);
  const n3 = useCountUp(numericTargets[3] ?? 0, numericTargets[3] != null);
  const animated = [n0, n1, n2, n3];

  return (
    <section className="section card dashboard-hero" aria-label={t('dashboard.ariaExecutiveKpis')}>
      <div className="dashboard-hero__head">
        <div className="dashboard-hero__title-wrap">
          <p className="dashboard-hero__kicker">{t('dashboard.executive.title')}</p>
          <h2 className="dashboard-hero__title">{t('dashboard.executive.hint')}</h2>
        </div>
        <div className={`dashboard-risk-badge dashboard-risk-badge--${riskTone}`} role="status">
          {riskTone === 'danger'
            ? t('dashboard.riskHigh')
            : riskTone === 'warn'
              ? t('dashboard.riskMedium')
              : t('dashboard.riskLow')}
        </div>
      </div>

      <div
        className="dashboard-hero__kpis"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {primaryKpis.map(({ labelKey, value, tone }, idx) => {
          const isNum = numericTargets[idx] != null;
          const shown = isNum ? Math.round(animated[idx] || 0).toLocaleString() : value;
          const badge =
            tone === 'profit'
              ? { text: '+12%', variant: 'positive' as const }
              : tone === 'sales'
                ? { text: '+8%', variant: 'positive' as const }
                : tone === 'inventory'
                  ? { text: '-3%', variant: 'negative' as const }
                  : { text: '+2%', variant: 'neutral' as const };
          return (
          <div
            key={labelKey}
            className={`card dashboard-mini-kpi dashboard-mini-kpi--${tone}`}
            style={{ padding: 20 }}
          >
            <div className="card-header">
              <span className="title">{t(labelKey)}</span>
              <span className={`badge ${badge.variant}`}>{badge.text}</span>
            </div>
            <span className="dashboard-mini-kpi__value dashboard-mini-kpi__value--xl" style={{ fontSize: 30, fontWeight: 800 }}>
              {shown}
            </span>
          </div>
          );
        })}
      </div>
    </section>
  );
}

