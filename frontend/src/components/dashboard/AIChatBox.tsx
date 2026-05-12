import { useMemo } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * AI Assistant — UI-only preview panel.
 *
 * Controlled by the parent layout: the floating FAB lives elsewhere (the
 * sidebar footer trigger). This component only renders the dialog when
 * `open` is true.
 */
export interface AIChatBoxProps {
  open: boolean;
  onClose: () => void;
}

export function AIChatBox({ open, onClose }: AIChatBoxProps) {
  const { t } = useTranslation();
  const title = useMemo(() => t('aiChat.title', 'Fusiku AI'), [t]);
  if (!open) return null;

  return (
    <div className="ai-chatbox ai-chatbox--ai" aria-live="polite">
      <div className="ai-chatbox__panel chat-window" role="dialog" aria-label={title}>
        <div className="ai-chatbox__header chat-header">
          <div className="ai-chatbox__title">
            <span className="ai-chatbox__orb" aria-hidden />
            <div className="ai-chatbox__titleText">
              <div className="ai-chatbox__titleTop">{title}</div>
              <div className="ai-chatbox__subtitle">
                {t('aiChat.subtitle', 'Assistant (UI preview)')}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="ai-chatbox__close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="ai-chatbox__body">
          <div className="ai-chatbox__empty" role="status">
            <div className="ai-chatbox__emptyIcon" aria-hidden>
              <MessageCircle size={18} />
            </div>
            <div className="ai-chatbox__emptyText">
              <div className="ai-chatbox__emptyTitle">
                {t('aiChat.comingSoonTitle', 'Chat is coming soon')}
              </div>
              <div className="ai-chatbox__emptyHint">
                {t('aiChat.comingSoonHint', 'This is a UI-only preview. No backend logic yet.')}
              </div>
            </div>
          </div>
        </div>

        <div className="ai-chatbox__composer" aria-disabled>
          <input
            className="ai-chatbox__input chat-input"
            placeholder={t('aiChat.placeholder', 'Ask about sales, profit, inventory…')}
            disabled
            value=""
            readOnly
          />
          <button type="button" className="ai-chatbox__send" disabled>
            {t('chat.send', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}
