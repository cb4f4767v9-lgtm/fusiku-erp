import type { LucideIcon } from 'lucide-react';

export type SidebarNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onNavigate: (path: string) => void;
};

export function SidebarItem({ path, label, icon: Icon, isActive, onNavigate }: SidebarNavItem) {
  return (
    <button
      type="button"
      className={`nav-item sidebar-item ${isActive ? 'active' : ''}`}
      onClick={() => onNavigate(path)}
      aria-current={isActive ? 'page' : undefined}
      title={label}
    >
      <Icon size={19} strokeWidth={1.75} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
