import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

export type NavShellContextValue = {
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  mobileNavOpen: boolean;
  toggleMobileNav: () => void;
  closeMobileNav: () => void;
};

const NavShellContext = createContext<NavShellContextValue | null>(null);

const SIDEBAR_COLLAPSED_KEY = 'fusiku_shell_sidebar_collapsed';

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(next: boolean) {
  try {
    if (next) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
  } catch {
    /* ignore */
  }
}

export function NavShellProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c;
      persistSidebarCollapsed(next);
      return next;
    });
  }, []);

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((o) => !o);
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  useEffect(() => {
    closeMobileNav();
  }, [location.pathname, closeMobileNav]);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileNavOpen,
      toggleMobileNav,
      closeMobileNav,
    }),
    [sidebarCollapsed, toggleSidebarCollapsed, mobileNavOpen, toggleMobileNav, closeMobileNav]
  );

  return <NavShellContext.Provider value={value}>{children}</NavShellContext.Provider>;
}

export function useNavShell() {
  const ctx = useContext(NavShellContext);
  if (!ctx) {
    throw new Error('useNavShell must be used within NavShellProvider');
  }
  return ctx;
}
