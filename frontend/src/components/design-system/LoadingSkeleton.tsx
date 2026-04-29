
type TableSkeletonProps = {
  rows?: number;
  cols?: number;
  className?: string;
};

export function TableSkeleton({ rows = 6, cols = 5, className }: TableSkeletonProps) {
  const r = Math.max(1, Math.min(rows, 20));
  const c = Math.max(1, Math.min(cols, 12));
  return (
    <div className={`table-container page-skeleton-wrap ${className || ''}`.trim()} aria-busy="true">
      <table className="data-table page-skeleton-table">
        <thead>
          <tr>
            {Array.from({ length: c }).map((_, i) => (
              <th key={i}>
                <span className="page-skeleton-line page-skeleton-line--short" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: r }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: c }).map((_, ci) => (
                <td key={ci}>
                  <span className="page-skeleton-line" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DashboardSkeletonProps = { className?: string };

export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div className={`dashboard-skeleton ${className || ''}`.trim()} aria-busy="true">
      <div className="dashboard-skeleton__header">
        <span className="page-skeleton-line page-skeleton-line--title" />
        <span className="page-skeleton-line page-skeleton-line--subtitle" />
      </div>
      <div className="dashboard-skeleton__kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dashboard-skeleton__card">
            <span className="page-skeleton-line page-skeleton-line--short" />
            <span className="page-skeleton-line page-skeleton-line--value" />
          </div>
        ))}
      </div>
      <div className="dashboard-skeleton__grid">
        <div className="dashboard-skeleton__panel">
          <span className="page-skeleton-line page-skeleton-line--short" />
          <span className="page-skeleton-block" />
        </div>
        <div className="dashboard-skeleton__panel">
          <span className="page-skeleton-line page-skeleton-line--short" />
          <span className="page-skeleton-block page-skeleton-block--short" />
        </div>
      </div>
    </div>
  );
}

export type LoadingSkeletonProps = {
  variant?: 'table' | 'dashboard';
  rows?: number;
  cols?: number;
  className?: string;
};

/** Unified loading placeholder; defaults to table skeleton. */
export function LoadingSkeleton({ variant = 'table', rows, cols, className }: LoadingSkeletonProps) {
  if (variant === 'dashboard') return <DashboardSkeleton className={className} />;
  return <TableSkeleton rows={rows} cols={cols} className={className} />;
}
