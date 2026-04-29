import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sidebarSections } from '../../config/sidebarItems';
import { useBranding } from '../../contexts/BrandingContext';
import { useNavShell } from '../../contexts/NavShellContext';
import { useAuth } from '../../hooks/useAuth';
import { useInputLanguage } from '../../hooks/useInputLanguage';
import { canAccessModule } from '../../utils/permissions';
const logoIconUrl = '/logo-icon.svg';
import { SidebarSection } from './SidebarSection';

const initialOpen = Object.fromEntries(sidebarSections.map((s) => [s.id, true]));

export function Sidebar() {
  const { t } = useTranslation();
  const { companyName, companyLogoUrl } = useBranding();
  const { sidebarCollapsed, mobileNavOpen, closeMobileNav } = useNavShell();
  const inputLang = useInputLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(initialOpen);

  const query = search.trim().toLowerCase();

  const sectionsForNav = useMemo(() => {
    return sidebarSections
      .map((section) => {
        const items = section.items.filter((item) => {
          if (!canAccessModule(user, item.permissionKey)) return false;
          if (!query) return true;
          const label = t(item.labelKey).toLowerCase();
          return label.includes(query) || item.keywords.some((k) => k.toLowerCase().includes(query));
        });
        return { section, items };
      })
      .filter((x) => x.items.length > 0);
  }, [query, t, user]);

  const go = (path: string) => {
    navigate(path);
    closeMobileNav();
  };

  const asideClass = [
    'sidebar',
    'modern-sidebar',
    sidebarCollapsed ? 'sidebar--collapsed' : '',
    mobileNavOpen ? 'sidebar--mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside id="app-sidebar" className={asideClass}>
      <div className="sidebar-header sidebar-brand">
        <div className="sidebar-brand-row">
          <span className="sidebar-brand-logoBox" aria-hidden>
            <img src={companyLogoUrl || logoIconUrl} className="sidebar-logo-horizontal" alt="" />
          </span>
          <span className="sidebar-brand-name">{t('brand.name', { defaultValue: 'Fusiku' })}</span>
        </div>
        <div className="sidebar-brand-slogan">{companyName || t('brand.slogan')}</div>
      </div>

      <div className="sidebar-search-wrap">
        <Search size={14} className="sidebar-search-icon" />
        <input
          type="text"
          placeholder={t('sidebar.searchModules')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          lang={inputLang}
          className="sidebar-search"
        />
      </div>

      <nav className="sidebar-nav" aria-label={t('sidebar.navigation') || 'Navigation'}>
        {sectionsForNav.map(({ section, items }) => (
          <SidebarSection
            key={section.id}
            label={t(section.labelKey)}
            isOpen={query ? true : openSections[section.id] !== false}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                [section.id]: !(prev[section.id] ?? true),
              }))
            }
            items={items.map((item) => {
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return {
                path: item.path,
                label: t(item.labelKey),
                icon: item.icon,
                isActive,
                onNavigate: go,
              };
            })}
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer__cluster">
          <div className="sidebar-footer__row">
            <div className="sidebar-copyright">{t('brand.copyrightShort')}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
