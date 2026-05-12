import { memo } from 'react';
import type { TFunction } from 'i18next';
import { ArrowRight } from 'lucide-react';
import type { InstituteEnrollment, InstituteStudent } from '../../services/api';
import { formatCurrency } from '../../utils/formatting';
import { pickPrimaryEnrollment, formatTimingSlot } from '../../utils/instituteTableHelpers';

export type StudentRowAgg = { total: number; paid: number; balance: number };

type Props = {
  student: InstituteStudent;
  agg: StudentRowAgg;
  currency: string;
  enrollments: InstituteEnrollment[];
  onNavigate: (id: string) => void;
  onRowKey: (e: React.KeyboardEvent, id: string) => void;
  t: TFunction;
};

function statusPillClass(status: string): string {
  const x = String(status || '').toLowerCase().replace(/\s+/g, '_');
  return `institute-pill institute-pill--${x}`;
}

function InstituteStudentTableRowInner({
  student: s,
  agg: a,
  currency: rowCurrency,
  enrollments,
  onNavigate,
  onRowKey,
  t,
}: Props) {
  const balanceDue = a.balance > 0.0001;
  const balanceClass = `num institute-amount${balanceDue ? ' institute-amount--due' : ' institute-amount--zero'}`;
  const en = pickPrimaryEnrollment(enrollments, s.id);
  const courseTitle = en?.batch?.course?.title ?? '—';
  const batchName = en?.batch?.name ?? '—';
  const timing = en ? formatTimingSlot(en.batch.timingSlot, en.batch.timingLabel, t) : '—';

  return (
    <tr
      className="institute-table__row--click"
      tabIndex={0}
      role="link"
      onClick={() => onNavigate(s.id)}
      onKeyDown={(e) => onRowKey(e, s.id)}
    >
      <td className="institute-col-photo">
        {s.profilePhotoUrl ? (
          <img src={s.profilePhotoUrl} alt="" className="institute-table__thumb" loading="lazy" />
        ) : (
          <span className="institute-table__thumb institute-table__thumb--ph" aria-hidden>
            {(s.fullName || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </td>
      <td className="institute-table__id-cell">{s.studentCode || '—'}</td>
      <td>
        <span className="institute-table__name">{s.fullName}</span>
      </td>
      <td>{s.phone || '—'}</td>
      <td>{s.guardianPhone || '—'}</td>
      <td>{courseTitle}</td>
      <td>{batchName}</td>
      <td className="institute-table__timing institute-col-timing">{timing}</td>
      <td>
        <span className={statusPillClass(s.status)}>{s.status}</span>
      </td>
      <td className="num">{formatCurrency(a.total, rowCurrency)}</td>
      <td className={balanceClass}>{formatCurrency(a.balance, rowCurrency)}</td>
      <td
        className="institute-table__muted institute-col-attendance"
        title={t('institute.placeholderAttendanceHint')}
      >
        —
      </td>
      <td className="institute-table__muted institute-col-result" title={t('institute.placeholderResultHint')}>
        —
      </td>
      <td className="institute-col-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn-ghost btn-sm institute-table__action-btn"
          title={t('institute.openStudentProfile')}
          onClick={() => onNavigate(s.id)}
        >
          <ArrowRight size={18} aria-hidden />
        </button>
      </td>
    </tr>
  );
}

export const InstituteStudentTableRow = memo(InstituteStudentTableRowInner);
