import { useTranslation } from 'react-i18next';
import { Building2, Lock } from 'lucide-react';
import { useBranchContext } from '../contexts/BranchContext';

type Props = {
  className?: string;
};

export function TopbarBranchSelector({ className }: Props) {
  const { t } = useTranslation();
  const { branches, loading, selectedBranchId, locked, setSelectedBranchId, selectedBranchName } = useBranchContext();

  // Always visible. Restricted users see a locked, non-editable control.
  return (
    <div className={['topbar-branch', className || ''].filter(Boolean).join(' ')}>
      <div className="topbar-branch__icon" aria-hidden>
        <Building2 size={18} />
      </div>

      {locked ? (
        <div className="topbar-branch__locked" title={t('branches.lockedToBranch', { defaultValue: 'Locked to your branch' })}>
          <span className="topbar-branch__label">{t('branches.branch', { defaultValue: 'Branch' })}</span>
          <span className="topbar-branch__value">{selectedBranchName || t('branches.currentBranch', { defaultValue: 'Current branch' })}</span>
          <span className="topbar-branch__lock" aria-hidden>
            <Lock size={14} />
          </span>
        </div>
      ) : (
        <label className="topbar-branch__select">
          <span className="sr-only">{t('branches.branch', { defaultValue: 'Branch' })}</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            disabled={loading}
            aria-label={t('branches.branch', { defaultValue: 'Branch' })}
          >
            <option value="">{t('branches.allBranches', { defaultValue: 'All branches' })}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || b.id}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

