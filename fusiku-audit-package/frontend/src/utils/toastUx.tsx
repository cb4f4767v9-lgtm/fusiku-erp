import toast from 'react-hot-toast';
import { getErrorMessage } from './getErrorMessage';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastOptions = {
  /** Extra time for reading/action. */
  duration?: number;
  /** Optional inline action button. */
  action?: ToastAction;
};

function ToastBody({ tone, message, action }: { tone?: ToastTone; message: string; action?: ToastAction }) {
  return (
    <div className="ds-toast">
      <div className="ds-toast__content">
        <div className="ds-toast__message">{message}</div>
        {tone ? <div className={`ds-toast__tone ds-toast__tone--${tone}`} aria-hidden /> : null}
      </div>
      {action ? (
        <button
          type="button"
          className="ds-toast__action"
          onClick={(e) => {
            e.preventDefault();
            action.onClick();
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export const toastUx = {
  success(message: unknown, opts: ToastOptions = {}) {
    const text = getErrorMessage(message, 'Success');
    return toast.success(<ToastBody tone="success" message={text} action={opts.action} />, {
      duration: opts.duration ?? 2800,
    });
  },
  error(message: unknown, opts: ToastOptions = {}) {
    const text = getErrorMessage(message, 'Unable to load data');
    return toast.error(<ToastBody tone="error" message={text} action={opts.action} />, {
      duration: opts.duration ?? 3600,
    });
  },
  warning(message: unknown, opts: ToastOptions = {}) {
    const text = getErrorMessage(message, 'Warning');
    return toast(<ToastBody tone="warning" message={text} action={opts.action} />, {
      duration: opts.duration ?? 3600,
      icon: '⚠',
    });
  },
  info(message: unknown, opts: ToastOptions = {}) {
    const text = getErrorMessage(message, 'Info');
    return toast(<ToastBody tone="info" message={text} action={opts.action} />, {
      duration: opts.duration ?? 3200,
      icon: 'ℹ',
    });
  },
  loading(message: unknown, opts: ToastOptions = {}) {
    const text = getErrorMessage(message, 'Loading…');
    return toast.loading(<ToastBody message={text} action={opts.action} />, {
      duration: opts.duration ?? Infinity,
    });
  },
  dismiss(id?: string) {
    toast.dismiss(id);
  },
};

