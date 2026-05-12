export function AIInsightPanel(props: { t: (key: string, opts?: any) => string }) {
  const { t } = props;
  return (
    <section className="section card dashboard-ai-insights" aria-label={t('dashboard.aiInsights', { defaultValue: 'AI Insights' })}>
      <div className="dashboard-ai-insights__head">
        <h2 className="dashboard-ai-insights__title">{t('dashboard.aiInsights', { defaultValue: 'AI Insights' })}</h2>
        <div className="dashboard-ai-insights__badge" role="status">
          {t('dashboard.aiInsightsBadge', { defaultValue: 'Preview' })}
        </div>
      </div>

      <div className="dashboard-ai-insights__list" role="list">
        <div className="dashboard-ai-insights__item dashboard-ai-insights__item--good" role="listitem">
          <span className="dashboard-ai-insights__icon" aria-hidden>
            📈
          </span>
          <div className="dashboard-ai-insights__text">
            {t('dashboard.aiInsight1', {
              defaultValue: 'Sales may increase this week based on recent trends',
            })}
          </div>
        </div>
        <div className="dashboard-ai-insights__item dashboard-ai-insights__item--warn" role="listitem">
          <span className="dashboard-ai-insights__icon" aria-hidden>
            ⚠️
          </span>
          <div className="dashboard-ai-insights__text">
            {t('dashboard.aiInsight2', { defaultValue: 'Low stock detected for 3 products' })}
          </div>
        </div>
        <div className="dashboard-ai-insights__item dashboard-ai-insights__item--tip" role="listitem">
          <span className="dashboard-ai-insights__icon" aria-hidden>
            💡
          </span>
          <div className="dashboard-ai-insights__text">
            {t('dashboard.aiInsight3', { defaultValue: 'Consider increasing price on high-demand items' })}
          </div>
        </div>
      </div>
    </section>
  );
}

