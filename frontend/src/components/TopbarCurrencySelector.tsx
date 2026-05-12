import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';
import { readStoredAccessToken } from '../utils/authSession';

/** Display currencies aligned with backend `REQUIRED_CURRENCY_CODES` (subset for topbar). */
const DISPLAY_CURRENCIES = ['USD', 'AED', 'PKR', 'CNY', 'EUR', 'GBP', 'SAR', 'INR', 'TRY', 'HKD'] as const;

const DROPDOWN_GAP = 8;

export function TopbarCurrencySelector() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { selectedCurrency, setSelectedCurrency } = useCurrency();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const isRtl = typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl';
    const minW = Math.max(r.width, 112);
    if (isRtl) {
      setMenuStyle({
        position: 'fixed',
        top: r.bottom + DROPDOWN_GAP,
        right: Math.max(8, window.innerWidth - r.right),
        left: 'auto',
        minWidth: minW,
        zIndex: 9999,
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        top: r.bottom + DROPDOWN_GAP,
        left: Math.max(8, r.left),
        minWidth: minW,
        zIndex: 9999,
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      const menu = document.getElementById(`${listboxId}-panel`);
      if (menu?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, listboxId]);

  const persistCurrency = (code: string) => {
    setSelectedCurrency(code);
    const hasSession = !!(token || readStoredAccessToken());
    if (hasSession) {
      void authApi.updatePreferences({ currency: code }).catch(() => {
        /* offline */
      });
    }
  };

  const dropdown =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        id={`${listboxId}-panel`}
        role="listbox"
        aria-label={t('currency.displayCurrency')}
        className="topbar-currency-dropdown-popover dropdown-menu select-dropdown popover"
        style={menuStyle}
      >
        {DISPLAY_CURRENCIES.map((code) => (
          <button
            key={code}
            type="button"
            role="option"
            aria-selected={selectedCurrency === code}
            className="dropdown-item topbar-currency-dropdown__option"
            onClick={() => {
              persistCurrency(code);
              setOpen(false);
            }}
          >
            {code}
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <div className="topbar-currency display-container">
      <span className="topbar-currency__label display-label">{t('currency.displayCurrency')}</span>
      <button
        ref={triggerRef}
        type="button"
        id={`${listboxId}-trigger`}
        className="topbar-currency__select topbar-currency__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? `${listboxId}-panel` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="topbar-currency__value">{selectedCurrency}</span>
        <ChevronDown size={14} aria-hidden className="topbar-currency__chevron" strokeWidth={2} />
      </button>
      {dropdown}
    </div>
  );
}
