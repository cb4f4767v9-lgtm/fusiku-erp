import type { ReactNode } from 'react';

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={['ds-empty-state', 'page-state', 'page-state--empty', className].filter(Boolean).join(' ')}
      role="status"
    >
      {icon ? <div className="page-state__icon" aria-hidden="true">{icon}</div> : null}
      <p className="page-state__title">{title}</p>
      {description ? <p className="page-state__hint muted">{description}</p> : null}
      {action ? <div className="page-state__actions">{action}</div> : null}
    </div>
  );
}
