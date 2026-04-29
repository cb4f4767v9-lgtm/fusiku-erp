import { ChevronDown } from 'lucide-react';
import { SidebarItem, type SidebarNavItem } from './SidebarItem';

export function SidebarSection({
  label,
  items,
  isOpen,
  onToggle,
}: {
  label: string;
  items: SidebarNavItem[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="sidebar-section">
      <button type="button" className={`sidebar-section-label ${isOpen ? 'open' : ''}`} onClick={onToggle}>
        <span className="sidebar-section-label__text">{label}</span>
        <ChevronDown size={14} strokeWidth={2} className="sidebar-section-label__chevron" aria-hidden />
      </button>

      <div className={`sidebar-section-items ${isOpen ? 'open' : 'closed'}`}>
        {items.map((item) => (
          <SidebarItem key={item.path} {...item} />
        ))}
      </div>
    </div>
  );
}

