import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { sidebarItems } from '../config/sidebarItems';

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');

  const filteredItems = sidebarItems.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      t(item.labelKey).toLowerCase().includes(search.toLowerCase()) ||
      item.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header sidebar-brand">
        <div className="sidebar-brand-row">
          <img src="./logo-icon.svg" className="sidebar-logo-horizontal" alt={t('brand.name')} />
          <span className="sidebar-brand-name">{t('brand.name')}</span>
        </div>
        <div className="sidebar-brand-slogan">{t('brand.slogan')}</div>
      </div>
      <div className="sidebar-search-wrap">
        <Search size={14} className="sidebar-search-icon" />
        <input
          type="text"
          placeholder={t('sidebar.searchModules')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sidebar-search"
        />
      </div>
      <nav className="sidebar-nav">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <div
              key={item.path}
              className={`nav-item sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(item.path);
                }
              }}
            >
              <Icon size={18} />
              <span>{t(item.labelKey)}</span>
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="powered-by">
        <img src="./logo-icon.svg" height="18" alt="Fusiku" />
          <span>{t('brand.poweredBy')}</span>
        </div>
      </div>
    </aside>
  );
}