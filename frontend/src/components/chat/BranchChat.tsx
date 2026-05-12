import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { branchesApi, chatApi, type ChatMessage, type ChatRoom } from '../../services/api';
import { emitAck, getSocket, isWebSocketDisabled } from '../../services/socket';

/**
 * Internal Branch Chat — controlled panel.
 *
 * The component renders only the chat *panel* (no FAB). The owning layout
 * decides when to show it via the `open` prop and where the trigger lives
 * (sidebar footer, header button, etc.).
 *
 * Unread tracking lives in the parent so the trigger button can show a badge
 * without re-mounting the chat — the component must always be rendered (so
 * its socket listeners stay attached) but only paints DOM when `open` is true.
 */

const SOUND_ENABLED_KEY = 'fusiku_chat_sound_enabled';

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeSoundPref(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null;

function playDing(): void {
  try {
    const Ctx =
      (window as Window & { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    /* ignore audio errors */
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

type Branch = { id: string; name: string };

export interface BranchChatProps {
  /** Whether the chat panel is visible. Controlled by the parent layout. */
  open: boolean;
  /** Called when the user dismisses the panel (X button). */
  onClose: () => void;
  /**
   * Unread counter setter — called when a new message arrives while `open` is
   * `false` (or for a non-active room). The parent renders the badge.
   * Receives a callback so it can use functional updates.
   */
  onUnreadChange?: (updater: (prev: number) => number) => void;
}

export function BranchChat({ open, onClose, onUnreadChange }: BranchChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => readSoundPref());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const activeRoomIdRef = useRef<string | null>(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;

  // ---- Initial data load (rooms + branches) ----
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [{ data: roomsData }, branchesRes] = await Promise.all([
          chatApi.listRooms(),
          branchesApi.getAll(),
        ]);
        if (cancelled) return;
        const roomList = Array.isArray(roomsData) ? roomsData : [];
        setRooms(roomList);
        if (roomList.length > 0 && !activeRoomIdRef.current) {
          const ownBranch = roomList.find(
            (r) => r.kind === 'BRANCH' && r.branchId === (user.branchId ?? null)
          );
          setActiveRoomId(ownBranch?.id ?? roomList[0]!.id);
        }
        const rawBranches = Array.isArray(branchesRes.data)
          ? branchesRes.data
          : Array.isArray((branchesRes.data as { data?: unknown })?.data)
            ? ((branchesRes.data as { data: unknown[] }).data)
            : [];
        const norm = (rawBranches as { id?: unknown; name?: unknown }[])
          .filter((b) => typeof b?.id === 'string' && typeof b?.name === 'string')
          .map((b) => ({ id: String(b.id), name: String(b.name) }));
        setBranches(norm);
      } catch {
        if (!cancelled) {
          setRooms([]);
          setBranches([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.branchId]);

  // ---- Socket: listeners (optional — disabled via VITE_DISABLE_WEBSOCKET=1) ----
  useEffect(() => {
    if (!user?.id || isWebSocketDisabled()) return;
    const socket = getSocket();

    const handleMessage = (msg: ChatMessage) => {
      if (msg.chatRoomId === activeRoomIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (!openRef.current && msg.sender?.id !== user.id) {
          onUnreadChangeRef.current?.((n) => n + 1);
          if (soundEnabled) playDing();
        }
      } else if (msg.sender?.id !== user.id) {
        onUnreadChangeRef.current?.((n) => n + 1);
        if (soundEnabled) playDing();
      }
    };

    const handleTyping = (payload: { roomId: string; userId: string }) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      if (payload.userId === user.id) return;
      setTypingUserIds((prev) => {
        const next = new Set(prev);
        next.add(payload.userId);
        return next;
      });
      window.setTimeout(() => {
        setTypingUserIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.userId);
          return next;
        });
      }, 2_500);
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
    };
    // soundEnabled is read from latest closure — rebinding on each toggle would
    // churn socket listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---- Switch room: load history + join socket room ----
  useEffect(() => {
    if (!activeRoomId) return;
    let cancelled = false;
    setMessages([]);
    setTypingUserIds(new Set());

    void (async () => {
      try {
        const { data } = await chatApi.listMessages(activeRoomId, { take: 50 });
        if (cancelled) return;
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();

    const socket = isWebSocketDisabled() ? null : getSocket();
    if (socket) {
      void emitAck(socket, 'chat:join', { roomId: activeRoomId }).catch(() => {
        /* ignore — REST send still works */
      });
    }

    return () => {
      cancelled = true;
      if (socket) {
        try {
          socket.emit('chat:leave', { roomId: activeRoomId });
        } catch {
          /* ignore */
        }
      }
    };
  }, [activeRoomId]);

  // ---- Auto-scroll on new messages while panel is open ----
  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  const onChangeRoom = (id: string) => {
    setActiveRoomId(id);
  };

  const sendMessage = useCallback(async () => {
    const body = draft.trim();
    if (!body || !activeRoomId || sending) return;
    setSending(true);
    try {
      let delivered = false;
      if (!isWebSocketDisabled()) {
        const socket = getSocket();
        if (socket.connected) {
          try {
            await emitAck<ChatMessage>(socket, 'chat:send', { roomId: activeRoomId, body }, 6_000);
            delivered = true;
          } catch {
            /* fall through to REST */
          }
        }
      }
      if (!delivered) {
        const { data } = await chatApi.sendMessage(activeRoomId, body);
        if (data && typeof data === 'object' && 'id' in data) {
          setMessages((prev) =>
            prev.some((m) => m.id === (data as ChatMessage).id) ? prev : [...prev, data as ChatMessage]
          );
        }
      }
      setDraft('');
    } catch {
      /* swallow — UI keeps the draft so the user can retry */
    } finally {
      setSending(false);
    }
  }, [draft, activeRoomId, sending]);

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const onTyping = () => {
    if (!activeRoomId || isWebSocketDisabled()) return;
    try {
      const s = getSocket();
      if (s.connected) s.emit('chat:typing', { roomId: activeRoomId });
    } catch {
      /* ignore */
    }
  };

  const onToggleSound = () => {
    setSoundEnabled((v) => {
      const next = !v;
      writeSoundPref(next);
      return next;
    });
  };

  const onOpenPairRoom = async (branchId: string) => {
    if (!branchId) return;
    try {
      const { data } = await chatApi.openRoom({ withBranchId: branchId });
      if (data?.id) {
        setRooms((prev) => (prev.some((r) => r.id === data.id) ? prev : [data, ...prev]));
        setActiveRoomId(data.id);
      }
    } catch {
      /* ignore */
    }
  };

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId]
  );

  const pairableBranches = useMemo(() => {
    const own = user?.branchId;
    return branches.filter((b) => b.id !== own);
  }, [branches, user?.branchId]);

  // Don't render anything for unauthenticated users or when closed —
  // the effects above keep socket listeners + unread tracking alive
  // because the component itself stays mounted at the layout level.
  if (!user?.id || !open) return null;

  return (
    <div className="ai-chatbox" aria-live="polite">
      <div
        className="ai-chatbox__panel chat-window"
        role="dialog"
        aria-label={t('chat.title', 'Branch Chat')}
      >
        <div className="ai-chatbox__header chat-header">
          <div className="ai-chatbox__title">
            <span className="ai-chatbox__orb" aria-hidden />
            <div className="ai-chatbox__titleText">
              <div className="ai-chatbox__titleTop">{t('chat.title', 'Branch Chat')}</div>
              <div className="ai-chatbox__subtitle">
                {activeRoom?.name ?? t('chat.subtitle', 'Internal team chat')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="branch-chat__soundToggle"
              onClick={onToggleSound}
              aria-label={
                soundEnabled
                  ? t('chat.muteSound', 'Mute notifications')
                  : t('chat.unmuteSound', 'Unmute notifications')
              }
              title={
                soundEnabled
                  ? t('chat.muteSound', 'Mute notifications')
                  : t('chat.unmuteSound', 'Unmute notifications')
              }
            >
              {soundEnabled ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
            </button>
            <button
              type="button"
              className="ai-chatbox__close"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <label
            htmlFor="branch-chat-room"
            style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6, opacity: 0.7 }}
          >
            {t('chat.selectRoom', 'Channel')}
          </label>
          <select
            id="branch-chat-room"
            className="branch-chat__roomPicker"
            value={activeRoomId ?? ''}
            onChange={(e) => onChangeRoom(e.target.value)}
          >
            {rooms.length === 0 ? (
              <option value="">{t('chat.noRooms', 'No channels yet')}</option>
            ) : null}
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.kind === 'COMPANY' ? `· ${t('chat.kindCompany', 'Company')}` : ''}
                {r.kind === 'BRANCH_PAIR' ? `· ${t('chat.kindPair', 'Cross-branch')}` : ''}
              </option>
            ))}
          </select>

          {pairableBranches.length > 0 ? (
            <select
              className="branch-chat__roomPicker"
              style={{ marginTop: 8 }}
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = '';
                void onOpenPairRoom(v);
              }}
            >
              <option value="" disabled>
                {t('chat.startPair', 'Start chat with another branch…')}
              </option>
              {pairableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="ai-chatbox__body" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div className="branch-chat__messages">
            {messages.length === 0 ? (
              <div className="branch-chat__empty">
                <MessageCircle size={20} aria-hidden />
                <div>{t('chat.empty', 'No messages yet — say hi to your team.')}</div>
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender?.id === user.id;
                return (
                  <div
                    key={m.id}
                    className={`branch-chat__msg ${mine ? 'branch-chat__msg--mine' : ''}`}
                  >
                    <div className="branch-chat__msgMeta">
                      <span className="branch-chat__msgSender">
                        {mine ? t('chat.you', 'You') : m.sender?.name || t('chat.unknownSender', 'Unknown')}
                      </span>
                      {m.senderBranch?.name ? (
                        <span className="branch-chat__msgBranch">{m.senderBranch.name}</span>
                      ) : null}
                      <span>· {formatTime(m.createdAt)}</span>
                    </div>
                    <div>{m.body}</div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {typingUserIds.size > 0 ? (
            <div className="branch-chat__typing">{t('chat.typing', 'Someone is typing…')}</div>
          ) : null}
        </div>

        <div className="ai-chatbox__composer">
          <input
            className="ai-chatbox__input chat-input"
            placeholder={t('chat.placeholder', 'Type a message…')}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onTyping();
            }}
            onKeyDown={onComposerKeyDown}
            maxLength={4000}
            disabled={!activeRoomId}
          />
          <button
            type="button"
            className="branch-chat__send"
            onClick={() => void sendMessage()}
            disabled={!activeRoomId || !draft.trim() || sending}
            aria-label={t('chat.send', 'Send')}
          >
            <Send size={14} aria-hidden style={{ marginRight: 4 }} />
            {t('chat.send', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}
