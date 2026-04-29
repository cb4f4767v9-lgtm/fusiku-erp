import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Standard page chrome: title, optional subtitle, right-aligned actions.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={`erp-page-header erp-page-header--standard ${className || ''}`.trim()}>
      <div className="erp-page-header__main">
        <h1 className="erp-page-header__title">
          {title}
        </h1>
        {subtitle ? <p className="erp-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="erp-page-header__actions">{actions}</div> : null}
    </header>
  );
}
