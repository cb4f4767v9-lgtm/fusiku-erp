import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Search,
} from 'lucide-react';
import { TableSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  hideBelow?: number;
  render: (row: T, index: number) => ReactNode;
  sortValue?: (row: T) => string | number | null;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  /** External search value (controlled) */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Client-side text search across all columns */
  searchFilter?: (row: T, query: string) => boolean;
  /** Page size (default 15) */
  pageSize?: number;
  /** External sort state (controlled) */
  sortKey?: string;
  sortDir?: SortDirection;
  onSortChange?: (key: string, dir: SortDirection) => void;
  /** Action buttons rendered in the toolbar */
  toolbarActions?: ReactNode;
  /** Status/filter select rendered in the toolbar */
  toolbarFilters?: ReactNode;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row class name */
  rowClassName?: string | ((row: T) => string);
  /** Empty state config */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Table class name */
  className?: string;
  /** Enable export CSV */
  exportCsv?: { filename: string; headers: string[]; row: (item: T) => string[] };
  /** Enable print */
  printTitle?: string;
  /** Sticky header (default true) */
  stickyHeader?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push(r.map(csvEscape).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search…',
  searchFilter,
  pageSize = 15,
  sortKey: externalSortKey,
  sortDir: externalSortDir,
  onSortChange,
  toolbarActions,
  toolbarFilters,
  onRowClick,
  rowClassName,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction,
  className,
  exportCsv,
  printTitle,
  stickyHeader = true,
}: DataTableProps<T>) {
  // Sort state — internal if not externally controlled
  const [internalSortKey, setInternalSortKey] = useState('');
  const [internalSortDir, setInternalSortDir] = useState<SortDirection>('asc');
  const sortKey = externalSortKey ?? internalSortKey;
  const sortDir = externalSortDir ?? internalSortDir;

  const [page, setPage] = useState(1);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Handle sort toggle
  const handleSort = useCallback(
    (key: string) => {
      const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
      if (onSortChange) {
        onSortChange(key, newDir);
      } else {
        setInternalSortKey(key);
        setInternalSortDir(newDir);
      }
      setPage(1);
    },
    [sortKey, sortDir, onSortChange]
  );

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim() || !searchFilter) return data;
    const q = search.trim().toLowerCase();
    return data.filter((row) => searchFilter(row, q));
  }, [data, search, searchFilter]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const sv = col.sortValue;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, clampedPage, pageSize]);

  // Export CSV
  const handleExportCsv = useCallback(() => {
    if (!exportCsv) return;
    const rows = sorted.map(exportCsv.row);
    downloadCsv(exportCsv.filename, exportCsv.headers, rows);
  }, [sorted, exportCsv]);

  // Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Loading skeleton
  if (loading && data.length === 0) {
    return <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} cols={columns.length} />;
  }

  const hasToolbar = onSearchChange || toolbarFilters || toolbarActions || exportCsv || printTitle;

  return (
    <div className={`dt-root ${className ?? ''}`.trim()}>
      {/* Toolbar */}
      {hasToolbar && (
        <div className="dt-toolbar">
          <div className="dt-toolbar__start">
            {onSearchChange && (
              <div className="dt-search">
                <Search size={16} className="dt-search__icon" aria-hidden />
                <input
                  type="search"
                  className="dt-search__input"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label={searchPlaceholder}
                />
              </div>
            )}
            {toolbarFilters}
          </div>
          <div className="dt-toolbar__end">
            {exportCsv && (
              <button
                type="button"
                className="btn btn-ghost btn-sm dt-toolbar__btn"
                onClick={handleExportCsv}
                title="Export CSV"
              >
                <Download size={16} aria-hidden />
              </button>
            )}
            {printTitle && (
              <button
                type="button"
                className="btn btn-ghost btn-sm dt-toolbar__btn"
                onClick={handlePrint}
                title="Print"
              >
                <Printer size={16} aria-hidden />
              </button>
            )}
            {toolbarActions}
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`dt-scroll ${stickyHeader ? 'dt-scroll--sticky' : ''}`}>
        <table className="dt-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className={[
                      col.align === 'right' ? 'dt-th--right' : col.align === 'center' ? 'dt-th--center' : '',
                      col.sortable ? 'dt-th--sortable' : '',
                      isSorted ? 'dt-th--active' : '',
                      col.className ?? '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={col.width ? { width: col.width } : undefined}
                    data-hide-below={col.hideBelow ?? undefined}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    role={col.sortable ? 'button' : undefined}
                    tabIndex={col.sortable ? 0 : undefined}
                    onKeyDown={
                      col.sortable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSort(col.key);
                            }
                          }
                        : undefined
                    }
                    aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="dt-th__label">
                      {col.header}
                      {col.sortable && (
                        <span className="dt-th__sort-icon" aria-hidden>
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            )
                          ) : (
                            <ArrowUpDown size={14} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="dt-empty-cell">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              paged.map((row, i) => {
                const key = keyExtractor(row);
                const rCls =
                  typeof rowClassName === 'function'
                    ? rowClassName(row)
                    : rowClassName ?? '';
                return (
                  <tr
                    key={key}
                    className={`dt-row ${onRowClick ? 'dt-row--clickable' : ''} ${rCls}`.trim()}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'link' : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={[
                          col.align === 'right' ? 'dt-td--right' : col.align === 'center' ? 'dt-td--center' : '',
                          col.className ?? '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        data-hide-below={col.hideBelow ?? undefined}
                      >
                        {col.render(row, (clampedPage - 1) * pageSize + i)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > pageSize && (
        <div className="dt-pagination">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={clampedPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className="dt-pagination__meta">
            {clampedPage} / {totalPages}
            <span className="dt-pagination__count"> ({sorted.length})</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* Loading overlay for silent refreshes */}
      {loading && data.length > 0 && <div className="dt-loading-bar" aria-label="Loading" />}
    </div>
  );
}
