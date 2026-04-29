import { useTranslation } from 'react-i18next';
import { SalesOrdersPage } from './SalesOrdersPage';

export function WholesaleSalesPage() {
  const { t } = useTranslation();
  return (
    <SalesOrdersPage
      title={t('nav.wholesaleSales', { defaultValue: 'Wholesale Sales' })}
      subtitle={t('wholesale.subtitle', {
        defaultValue: 'Create wholesale orders, confirm them, and convert them to invoices.',
      })}
    />
  );
}

