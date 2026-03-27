import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../components/Sidebar';
import { TopbarUserMenu } from '../components/TopbarUserMenu';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useSearch } from '../contexts/SearchContext';
import { ensureAutoUpdateDefault } from '../utils/autoUpdateSettings';
import { SyncStatusBanner } from '../components/SyncStatusBanner';

const PAGE_TITLES: Record<string, string> = {
  '/': 'nav.dashboard',
  '/inventory': 'nav.inventory',
  '/purchases': 'purchases.purchaseList',
  '/purchases/new': 'purchases.purchaseInvoice',
  '/suppliers': 'nav.suppliers',
  '/suppliers/new': 'suppliers.addSupplier',
  '/customers': 'nav.customers',
  '/customers/new': 'customers.addCustomer',
  '/branches': 'nav.branches',
  '/pos': 'nav.pos',
  '/repairs': 'nav.repairs',
  '/refurbishing': 'nav.refurbishing',
  '/transfers': 'nav.transfers',
  '/reports': 'nav.reports',
  '/reports/advanced': 'nav.advancedReports',
  '/inventory-history': 'nav.inventoryHistory',
  '/phone-database': 'nav.phoneDatabase',
  '/activity': 'nav.systemActivity',
  '/logs': 'nav.systemLogs',
  '/settings': 'nav.settings',
  '/master-data': 'nav.masterData',
  '/company-settings': 'nav.companySettings',
  '/monitoring': 'nav.monitoring',
  '/ai-business-intelligence': 'nav.aiBusinessIntelligence',
  '/developer-settings': 'nav.developerSettings',
  '/integration-logs': 'nav.integrationLogs',
  '/change-password': 'common.changePassword'
};

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useSearch();
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  /**
   * Electron: preload uses one IPC listener and forwards to the latest callback (no duplicate handlers).
   * autoUpdate ON → reload; OFF → banner with Update button (no alert).
   */
  useEffect(() => {
    ensureAutoUpdateDefault();
    if (!window.electron) return;

    window.electron.on('update-available', () => {
      const autoUpdate = localStorage.getItem('autoUpdate') === 'true';
      if (autoUpdate) {
        window.location.reload();
      } else {
        setShowUpdateBanner(true);
      }
    });
  }, []);
  const getTitleKey = () => {
    const p = location.pathname;
    if (PAGE_TITLES[p]) return PAGE_TITLES[p];
    if (/^\/suppliers\/[^/]+\/edit$/.test(p)) return 'suppliers.editSupplier';
    if (/^\/suppliers\/[^/]+$/.test(p) && p !== '/suppliers/new') return 'suppliers.supplierDetail';
    if (/^\/customers\/[^/]+\/edit$/.test(p)) return 'customers.editCustomer';
    return 'nav.dashboard';
  };
  const pageTitle = t(getTitleKey());

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <SyncStatusBanner />
        {showUpdateBanner && (
          <div className="update-banner" role="alert">
            <span>{t('common.newVersionAvailable')}</span>
            <button type="button" className="btn btn-sm btn-primary update-banner-reload" onClick={() => window.location.reload()}>
              {t('common.update')}
            </button>
          </div>
        )}
        <header className="topbar header">
          <span className="page-title">{pageTitle}</span>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder={location.pathname === '/purchases' ? t('search.purchasePlaceholder') : t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="language-dropdown">
            <LanguageSwitcher />
          </div>
          <div className="topbar-user">
            <TopbarUserMenu />
          </div>
        </header>
        <main className="main-content main-content-compact page-container">
          <Outlet />
        </main>
        <footer className="app-footer app-footer-compact">
          <div className="powered-by">
            <img src="./logo-icon.svg" alt="Fusiku" style={{ height: '14px' }} />
            <span>{t('brand.poweredBy')}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}