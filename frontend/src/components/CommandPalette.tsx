import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { canAccessModule } from '../utils/permissions';

export type CommandPaletteAction =
  | { id: string; label: string; keywords?: string[]; kind: 'page'; href: string; permissionKey: string }
  | { id: string; label: string; keywords?: string[]; kind: 'action'; run: () => void; permissionKey: string };

type Props = {
  open: boolean;
  onClose: () => void;
};

function normalize(s: string) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function scoreMatch(q: string, label: string, keywords: string[]) {
  if (!q) return 1;
  const l = normalize(label);
  if (l === q) return 100;
  if (l.startsWith(q)) return 60;
  if (l.includes(q)) return 35;
  for (const k of keywords) {
    const nk = normalize(k);
    if (!nk) continue;
    if (nk === q) return 55;
    if (nk.startsWith(q)) return 40;
    if (nk.includes(q)) return 25;
  }
  return 0;
}

export function CommandPalette({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const actions: CommandPaletteAction[] = useMemo(() => {
    const go = (href: string) => () => navigate(href);
    return [
      { id: 'nav.dashboard', kind: 'page', href: '/', permissionKey: 'dashboard.view', label: t('nav.dashboard') },
      { id: 'nav.pos', kind: 'page', href: '/pos', permissionKey: 'sales.pos', label: t('nav.pos'), keywords: ['sales', 'sell', 'checkout', 'invoice'] },
      { id: 'nav.inventory', kind: 'page', href: '/inventory', permissionKey: 'inventory.view', label: t('nav.inventory'), keywords: ['stock', 'imei'] },
      { id: 'nav.purchases', kind: 'page', href: '/purchases', permissionKey: 'purchases.view', label: t('nav.purchases'), keywords: ['buy', 'supplier invoice'] },
      { id: 'action.newPurchase', kind: 'action', run: go('/purchases/new'), permissionKey: 'purchases.create', label: t('purchases.newPurchase'), keywords: ['create purchase', 'new purchase'] },
      { id: 'nav.suppliers', kind: 'page', href: '/suppliers', permissionKey: 'suppliers.view', label: t('nav.suppliers'), keywords: ['vendors'] },
      { id: 'nav.reports', kind: 'page', href: '/reports', permissionKey: 'reports.view', label: t('nav.reports'), keywords: ['analytics', 'profit'] },
      { id: 'nav.expenses', kind: 'page', href: '/expenses', permissionKey: 'finance.expenses', label: t('nav.expenses') },
      { id: 'nav.currency', kind: 'page', href: '/currency', permissionKey: 'finance.currency', label: t('nav.currency'), keywords: ['fx', 'exchange'] },
      { id: 'nav.settings', kind: 'page', href: '/settings', permissionKey: 'settings.app', label: t('nav.settings') },
      { id: 'nav.customers', kind: 'page', href: '/customers', permissionKey: 'admin.customers', label: t('nav.customers') },
    ];
  }, [navigate, t]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    const items = actions
      .filter((a) => canAccessModule(user, a.permissionKey))
      .map((a) => {
        const kws = a.keywords ?? [];
        return { a, s: scoreMatch(q, a.label, kws) };
      })
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s || x.a.label.localeCompare(y.a.label))
      .map((x) => x.a);
    return items.slice(0, 12);
  }, [actions, query, user]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        const a = filtered[activeIndex];
        if (!a) return;
        e.preventDefault();
        if (a.kind === 'page') navigate(a.href);
        else a.run();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filtered, navigate, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cp-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  return (
    <div
      className="cp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('search.anythingPlaceholder')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cp-modal">
        <div className="cp-inputRow">
          <Search size={18} aria-hidden className="cp-icon" />
          <input
            ref={inputRef}
            className="cp-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder={t('search.anythingPlaceholder')}
            aria-label={t('search.anythingPlaceholder')}
          />
          <span className="cp-kbd" aria-hidden>
            Esc
          </span>
        </div>

        <div ref={listRef} className="cp-list" role="listbox" aria-label={t('search.anythingPlaceholder')}>
          {filtered.length ? (
            filtered.map((a, idx) => (
              <button
                key={a.id}
                type="button"
                className={['cp-item', idx === activeIndex ? 'cp-item--active' : ''].filter(Boolean).join(' ')}
                data-cp-index={idx}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  if (a.kind === 'page') navigate(a.href);
                  else a.run();
                  onClose();
                }}
              >
                <span className="cp-item__label">{a.label}</span>
                <span className="cp-item__meta">
                  {a.kind === 'page' ? (a.href === '/' ? 'Dashboard' : a.href) : t('common.action', { defaultValue: 'Action' })}
                </span>
              </button>
            ))
          ) : (
            <div className="cp-empty" role="status">
              {t('common.noResults', { defaultValue: 'No results' })}
            </div>
          )}
        </div>

        <div className="cp-footer" aria-hidden>
          <span className="cp-hint">
            <span className="cp-hint__kbd">↑</span>
            <span className="cp-hint__kbd">↓</span> to navigate
          </span>
          <span className="cp-hint">
            <span className="cp-hint__kbd">Enter</span> to open
          </span>
          <span className="cp-hint">
            <span className="cp-hint__kbd">Ctrl</span> <span className="cp-hint__kbd">K</span> anytime
          </span>
        </div>
      </div>
    </div>
  );
}

