import { useTranslation } from 'react-i18next';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';
import { readStoredAccessToken } from '../utils/authSession';

/** Display currencies aligned with backend `REQUIRED_CURRENCY_CODES` (subset for topbar). */
const DISPLAY_CURRENCIES = ['USD', 'AED', 'PKR', 'CNY', 'EUR', 'GBP', 'SAR', 'INR', 'TRY', 'HKD'] as const;

export function TopbarCurrencySelector() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { selectedCurrency, setSelectedCurrency } = useCurrency();

  return (
    <label
      className="topbar-currency ds-has-tooltip"
      data-tooltip={t('currency.displayCurrencyTooltip', {
        defaultValue: 'Display currency only changes how money is shown in the UI — it does not change stored ledger amounts.',
      })}
    >
      <span className="topbar-currency__label">{t('currency.displayCurrency')}</span>
      <select
        className="topbar-currency__select"
        value={selectedCurrency}
        onChange={(e) => {
          const code = e.target.value;
          setSelectedCurrency(code);
          const hasSession = !!(token || readStoredAccessToken());
          if (hasSession) {
            void authApi.updatePreferences({ currency: code }).catch(() => {
              /* offline */
            });
          }
        }}
        aria-label={t('currency.displayCurrency')}
      >
        {DISPLAY_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}
