import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type ErrorStateProps = {
  message: string;
  hint?: string;
  onRetry?: () => void;
  className?: string;
  /** Override default retry button label */
  retryLabel?: ReactNode;
};

export function ErrorState({ message, hint, onRetry, className, retryLabel }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div className={['ds-error-state', 'page-state', 'page-state--error', className].filter(Boolean).join(' ')} role="alert">
      <p className="page-state__title">{message}</p>
      {hint ? <p className="page-state__hint muted">{hint}</p> : null}
      {onRetry ? (
        <button type="button" className="btn btn-primary page-state__retry" onClick={onRetry}>
          {retryLabel ?? t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}
