import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n';

type Props = { children: ReactNode };

type State = { hasError: boolean };

/**
 * Catches render/lifecycle errors so a failed child does not blank the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[fusiku:error-boundary]', error?.message, error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <p className="error-boundary-fallback__title">{i18n.t('errorBoundary.title')}</p>
          <p className="error-boundary-fallback__hint">{i18n.t('errorBoundary.hint')}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
