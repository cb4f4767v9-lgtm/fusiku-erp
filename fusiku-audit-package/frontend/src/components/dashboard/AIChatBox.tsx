import { useMemo, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export function AIChatBox() {
  const [open, setOpen] = useState(false);
  const title = useMemo(() => 'Fusiku AI', []);

  return (
    <div className="ai-chatbox" aria-live="polite">
      {open ? (
        <div className="ai-chatbox__panel chat-window" role="dialog" aria-label={title}>
          <div className="ai-chatbox__header chat-header">
            <div className="ai-chatbox__title">
              <span className="ai-chatbox__orb" aria-hidden />
              <div className="ai-chatbox__titleText">
                <div className="ai-chatbox__titleTop">{title}</div>
                <div className="ai-chatbox__subtitle">Assistant (UI preview)</div>
              </div>
            </div>
            <button type="button" className="ai-chatbox__close" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} aria-hidden />
            </button>
          </div>

          <div className="ai-chatbox__body">
            <div className="ai-chatbox__empty" role="status">
              <div className="ai-chatbox__emptyIcon" aria-hidden>
                <MessageCircle size={18} />
              </div>
              <div className="ai-chatbox__emptyText">
                <div className="ai-chatbox__emptyTitle">Chat is coming soon</div>
                <div className="ai-chatbox__emptyHint">This is a UI-only preview. No backend logic yet.</div>
              </div>
            </div>
          </div>

          <div className="ai-chatbox__composer" aria-disabled>
            <input
              className="ai-chatbox__input chat-input"
              placeholder="Ask about sales, profit, inventory…"
              disabled
              value=""
              readOnly
            />
            <button type="button" className="ai-chatbox__send" disabled>
              Send
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`ai-chatbox__fab chat-float chat-fab ${open ? 'ai-chatbox__fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI chat' : 'Open AI chat'}
      >
        {open ? <X size={18} aria-hidden /> : <MessageCircle size={18} aria-hidden />}
      </button>
    </div>
  );
}

