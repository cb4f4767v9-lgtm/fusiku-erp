import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export type ErrorStateProps = {
  message: string;
  hint?: string;
  /** Collapsible monospace excerpt (dev / support); never a substitute for `hint`. */
  technicalDetails?: string;
  onRetry?: () => void;
  className?: string;
  /** Override default retry button label */
  retryLabel?: ReactNode;
  /** Override the default warning icon. Pass `null` to hide it entirely. */
  icon?: ReactNode | null;
};

/**
 * Card-style error block:
 *   [ ⚠ ]
 *   Title
 *   Message
 *   [ Retry ]
 *
 * The icon, strong text, and solid surface make this read as an actionable
 * error rather than a faded placeholder.
 */
export function ErrorState({
  message,
  hint,
  technicalDetails,
  onRetry,
  className,
  retryLabel,
  icon,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const showIcon = icon !== null;
  return (
    <div
      className={['ds-error-state', 'page-state', 'page-state--error', className].filter(Boolean).join(' ')}
      role="alert"
    >
      {showIcon ? (
        <div className="page-state__icon page-state__icon--warning" aria-hidden="true">
          {icon ?? <AlertTriangle />}
        </div>
      ) : null}
      <p className="page-state__title">{message}</p>
      {hint ? <p className="page-state__hint">{hint}</p> : null}
      {technicalDetails ? (
        <details className="ds-error-state__details">
          <summary className="ds-error-state__details-summary">{t('common.technicalDetails')}</summary>
          <pre className="ds-error-state__code" tabIndex={0}>
            {technicalDetails}
          </pre>
        </details>
      ) : null}
      {onRetry ? (
        <button type="button" className="btn btn-primary page-state__retry" onClick={onRetry}>
          {retryLabel ?? t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}
