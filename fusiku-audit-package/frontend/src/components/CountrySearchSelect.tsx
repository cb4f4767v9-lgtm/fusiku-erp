import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type CountryOption = { isoCode: string; name: string };

type Props = {
  /** ISO code (e.g. US) — single source of truth with parent form */
  value: string;
  onChange: (isoCode: string) => void;
  options: CountryOption[];
  placeholder: string;
  emptyLabel: string;
  'aria-label'?: string;
  id?: string;
};

/**
 * One control: searchable dropdown (Ant Design Select showSearch equivalent).
 * No duplicate text field — filter is inside the open panel only.
 */
export function CountrySearchSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  'aria-label': ariaLabel,
  id
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.isoCode === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.isoCode.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const display = selected ? selected.name : emptyLabel;

  return (
    <div className="erp-search-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="erp-search-select-trigger erp-input-compact"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`erp-search-select-value ${!selected ? 'erp-search-select-placeholder' : ''}`}>
          {display}
        </span>
        <ChevronDown size={16} className="erp-search-select-chevron" aria-hidden />
      </button>

      {open && (
        <div className="erp-search-select-panel" role="listbox">
          <input
            type="search"
            autoComplete="off"
            autoFocus
            className="erp-search-select-filter erp-input-compact"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <ul className="erp-search-select-list">
            <li>
              <button
                type="button"
                className="erp-search-select-option"
                role="option"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                {emptyLabel}
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.isoCode}>
                <button
                  type="button"
                  className={`erp-search-select-option ${o.isoCode === value ? 'is-active' : ''}`}
                  role="option"
                  onClick={() => {
                    onChange(o.isoCode);
                    setOpen(false);
                  }}
                >
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
