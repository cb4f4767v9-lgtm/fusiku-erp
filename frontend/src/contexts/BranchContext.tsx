import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { branchesApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { isSuperAdmin } from '../utils/permissions';

type Branch = { id: string; name?: string | null; code?: string | null };

type BranchContextValue = {
  branches: Branch[];
  loading: boolean;
  /** Selected branch id. Empty string means "All branches" (super-admin only). */
  selectedBranchId: string;
  /** True when user is restricted to a single branch (selector is visible but locked). */
  locked: boolean;
  setSelectedBranchId: (branchId: string) => void;
  selectedBranchName: string;
};

const BranchContext = createContext<BranchContextValue | null>(null);

const STORAGE_KEY = 'fusiku_selected_branch_id';

function readStoredBranchId(): string {
  try {
    return String(localStorage.getItem(STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function persistStoredBranchId(branchId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, branchId);
  } catch {
    /* ignore */
  }
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const superUser = isSuperAdmin(user);
  const locked = !superUser;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => readStoredBranchId());

  // Keep selected branch consistent with user permissions.
  useEffect(() => {
    const forced = String(user?.branchId || '').trim();
    if (!superUser) {
      setSelectedBranchIdState(forced);
      persistStoredBranchId(forced);
      return;
    }
    // Super-admin: empty = all branches. Ensure we don't keep a stale branch id after logout/login.
    const current = readStoredBranchId();
    if (current !== selectedBranchId) {
      setSelectedBranchIdState(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superUser, user?.branchId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    branchesApi
      .getAll()
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r.data) ? (r.data as Branch[]) : [];
        setBranches(list);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSelectedBranchId = (branchId: string) => {
    const next = String(branchId || '').trim();
    if (locked) return;
    setSelectedBranchIdState(next);
    persistStoredBranchId(next);
  };

  const selectedBranchName = useMemo(() => {
    if (!selectedBranchId) return 'All branches';
    const hit = branches.find((b) => b.id === selectedBranchId);
    return String(hit?.name || hit?.code || selectedBranchId);
  }, [branches, selectedBranchId]);

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      loading,
      selectedBranchId,
      locked,
      setSelectedBranchId,
      selectedBranchName,
    }),
    [branches, loading, selectedBranchId, locked, selectedBranchName]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranchContext() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranchContext must be used within BranchProvider');
  return ctx;
}

