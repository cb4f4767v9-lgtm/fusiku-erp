import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Menu, PanelLeftClose, PanelLeft, Search } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopbarUserMenu } from '../components/TopbarUserMenu';
import { useSearch } from '../contexts/SearchContext';
import { ensureAutoUpdateDefault } from '../utils/autoUpdateSettings';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { useBranding } from '../contexts/BrandingContext';
import { useSaasCommercialGate } from '../hooks/useSaasCommercialGate';
import { TopbarCurrencySelector } from '../components/TopbarCurrencySelector';
import { TopbarBranchSelector } from '../components/TopbarBranchSelector';
import { NavShellProvider, useNavShell } from '../contexts/NavShellContext';
const logoIconUrl = '/logo-icon.svg';
import { useInputLanguage } from '../hooks/useInputLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { CommandPalette } from '../components/CommandPalette';
import { preloadPrimaryRoutes } from '../routes/routePreload';

function LayoutShell() {
  const { t, i18n } = useTranslation();
  const { searchQuery, setSearchQuery } = useSearch();
  const { companyName, companyLogoUrl, showPoweredBy } = useBranding();
  const { bannerMessage } = useSaasCommercialGate();
  const { mobileNavOpen, closeMobileNav, toggleMobileNav, sidebarCollapsed, toggleSidebarCollapsed } = useNavShell();
  const inputLang = useInputLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const gPrefixRef = useRef<number | null>(null);

  const quickLinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const links = [
      { key: 'inventory', label: t('nav.inventory'), href: '/inventory', keywords: ['inv', 'inventory', 'imei', 'stock'] },
      { key: 'customers', label: t('nav.customers'), href: '/customers', keywords: ['cust', 'customer', 'clients'] },
      { key: 'sales', label: t('nav.reports'), href: '/reports', keywords: ['sale', 'sales', 'report', 'reports'] },
    ];
    return links
      .map((l) => ({ ...l, score: l.keywords.some((k) => q.includes(k)) ? 2 : l.label.toLowerCase().includes(q) ? 1 : 0 }))
      .filter((l) => l.score > 0 || q.length >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [searchQuery, t]);

  useEffect(() => {
    ensureAutoUpdateDefault();
  }, []);

  useEffect(() => {
    const idle =
      'requestIdleCallback' in window
        ? (window as any).requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 450);

    const cancel =
      'cancelIdleCallback' in window ? (window as any).cancelIdleCallback : (id: any) => window.clearTimeout(id);

    const id = idle(() => {
      void preloadPrimaryRoutes();
    });
    return () => cancel(id);
  }, []);

  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || (el as any).isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K opens command palette anywhere (except editable fields)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Global "G + ?" shortcuts (G then D/S/I/P)
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      const now = Date.now();

      if (key === 'g') {
        gPrefixRef.current = now;
        return;
      }

      const startedAt = gPrefixRef.current;
      if (startedAt && now - startedAt < 800) {
        if (key === 'd') navigate('/');
        if (key === 's') navigate('/pos');
        if (key === 'i') navigate('/inventory');
        if (key === 'p') navigate('/purchases');
        gPrefixRef.current = null;
      } else {
        gPrefixRef.current = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  useEffect(() => {
    const brand = t('brand.name');
    const p = location.pathname || '/';
    const titleKey =
      p === '/' ? 'dashboard.title'
      : p.startsWith('/inventory-history') ? 'inventoryHistory.title'
      : p.startsWith('/inventory') ? 'inventory.title'
      : p.startsWith('/purchases/new') ? 'purchases.newPurchase'
      : p.startsWith('/purchases') ? 'purchases.title'
      : p.startsWith('/suppliers') ? 'suppliers.title'
      : p.startsWith('/customers') ? 'customers.title'
      : p.startsWith('/branches') ? 'branches.title'
      : p.startsWith('/pos') ? 'pos.title'
      : p.startsWith('/repairs') ? 'repairs.title'
      : p.startsWith('/refurbishing') ? 'refurbishing.title'
      : p.startsWith('/transfers') ? 'transfers.title'
      : p.startsWith('/expenses') ? 'expenses.title'
      : p.startsWith('/reports/advanced') ? 'reports.advancedSubtitle'
      : p.startsWith('/reports') ? 'reports.title'
      : p.startsWith('/phone-database') ? 'phoneDatabase.title'
      : p.startsWith('/logs') ? 'logs.title'
      : p.startsWith('/activity') ? 'activity.title'
      : p.startsWith('/currency') ? 'currency.title'
      : p.startsWith('/plans') ? 'plans.title'
      : p.startsWith('/settings') ? 'settings.title'
      : p.startsWith('/master-data') ? 'masterData.title'
      : p.startsWith('/monitoring') ? 'monitoring.title'
      : p.startsWith('/ai-business-intelligence') ? 'ai.title'
      : p.startsWith('/ai-assistant') ? 'aiAssistant.title'
      : p.startsWith('/developer-settings') ? 'developer.title'
      : p.startsWith('/integration-logs') ? 'integrationLogs.title'
      : p.startsWith('/company-settings') ? 'company.title'
      : 'brand.name';

    const pageTitle = titleKey === 'brand.name' ? brand : t(titleKey);
    document.title = pageTitle ? `${pageTitle} · ${brand}` : brand;
  }, [location.pathname, t]);

  const layoutClass = [
    'app-layout',
    'modern',
    sidebarCollapsed ? 'app-layout--sidebar-collapsed' : '',
    mobileNavOpen ? 'app-layout--mobile-nav-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClass}>
      {mobileNavOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t('common.close')}
          onClick={closeMobileNav}
        />
      ) : null}

      <Sidebar />

      <div className="main-wrapper modern-main flex-1 min-w-0">
        <SyncStatusBanner />
        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

        {bannerMessage === 'hard' ? (
          <div className="saas-banner saas-banner--hard" role="status">
            <span>{t('saas.subscriptionExpired')}</span>
            <Link to="/plans" className="saas-banner__link">
              {t('saas.viewPlans')}
            </Link>
          </div>
        ) : bannerMessage === 'trial' ? (
          <div className="saas-banner saas-banner--trial" role="status">
            <span>{t('saas.trialEndedUpgrade')}</span>
            <Link to="/plans" className="saas-banner__link">
              {t('saas.viewPlans')}
            </Link>
          </div>
        ) : null}

        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-nav-toggles">
              <button
                type="button"
                className="icon-btn topbar-nav-toggles__mobile"
                aria-expanded={mobileNavOpen}
                aria-controls="app-sidebar"
                onClick={toggleMobileNav}
                aria-label={t('layout.openMenu')}
              >
                <Menu size={18} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn topbar-nav-toggles__desktop"
                onClick={toggleSidebarCollapsed}
                aria-label={sidebarCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
              >
                {sidebarCollapsed ? <PanelLeft size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
              </button>
            </div>
            <div className="topbar-tenant-brand" aria-hidden={!companyName && !companyLogoUrl}>
              <img
                src={companyLogoUrl || logoIconUrl}
                alt=""
                className="topbar-tenant-logo"
                width={32}
                height={32}
              />
              <span className="topbar-tenant-name">{companyName || t('brand.name')}</span>
            </div>
            <div className="topbar-search">
              <Search size={18} />
              <input
                type="text"
                placeholder={t('search.anythingPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                lang={inputLang}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const first = quickLinks[0];
                    if (first) navigate(first.href);
                  }
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              {quickLinks.length ? (
                <div className="topbar-search__popover" role="listbox" aria-label={t('search.anythingPlaceholder')}>
                  {quickLinks.map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      className="topbar-search__item"
                      onClick={() => {
                        navigate(l.href);
                        setSearchQuery('');
                      }}
                    >
                      {l.label}
                      <span className="topbar-search__hint">{l.href}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="topbar-right">
            <button type="button" className="icon-btn" aria-label={t('common.notifications')}>
              <Bell size={18} aria-hidden />
            </button>

            <TopbarBranchSelector />

            <TopbarCurrencySelector />

            <LanguageSwitcher placement="header" />

            <TopbarUserMenu />
          </div>
        </header>

        <main className="flex-1 min-w-0" style={{ flex: 1, width: '100%' }}>
          <div key={`${location.pathname}:${i18n.language}`} className="route-transition">
            <div className="w-full min-w-0">
              <Outlet />
            </div>
          </div>
        </main>
        {showPoweredBy ? (
          <footer className="main-footer-powered" role="contentinfo">
            {t('brand.poweredBy')}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function Layout() {
  return (
    <NavShellProvider>
      <LayoutShell />
    </NavShellProvider>
  );
}
