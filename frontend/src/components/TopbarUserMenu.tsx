import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { User, Settings, Key, LogOut, ChevronDown } from 'lucide-react';

export function TopbarUserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.role || 'User';

  return (
    <div className="topbar-user-menu" ref={ref}>
      <button
        type="button"
        className="topbar-user-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="topbar-user-name">{displayName}</span>
        <ChevronDown size={16} className="topbar-user-chevron" />
      </button>
      {open && (
        <div className="topbar-user-dropdown">
          <Link
            to="/settings"
            className="topbar-user-dropdown-item"
            onClick={() => setOpen(false)}
          >
            <User size={16} />
            <span>{t('auth.profile')}</span>
          </Link>
          <Link
            to="/change-password"
            className="topbar-user-dropdown-item"
            onClick={() => setOpen(false)}
          >
            <Key size={16} />
            <span>{t('auth.changePassword')}</span>
          </Link>
          <Link
            to="/settings"
            className="topbar-user-dropdown-item"
            onClick={() => setOpen(false)}
          >
            <Settings size={16} />
            <span>{t('nav.settings')}</span>
          </Link>
          <button
            type="button"
            className="topbar-user-dropdown-item topbar-user-dropdown-logout"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
