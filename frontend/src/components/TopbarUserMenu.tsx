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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.role || t('common.user');

  return (
    <div ref={ref} className="topbar-user-wrap">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="topbar-user-trigger"
      >
        <span>{displayName}</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="topbar-user-dropdown-panel">
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
          >
            <User size={16} />
            <span>{t('auth.profile')}</span>
          </Link>

          <Link
            to="/change-password"
            onClick={() => setOpen(false)}
          >
            <Key size={16} />
            <span>{t('auth.changePassword')}</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={16} />
            <span>{t('nav.settings')}</span>
          </Link>

          <button
            type="button"
            className="topbar-user-logout"
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
