import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Save } from 'lucide-react';
import {
  instituteApi,
  type InstituteBatchRow,
  type InstituteCourseRow,
  type InstituteAttendanceSummary,
} from '../../services/api';
import {
  PageLayout,
  PageHeader,
  DataTable,
  type DataTableColumn,
} from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';
import toast from 'react-hot-toast';

type AttendanceEntry = {
  enrollmentId: string;
  present: boolean;
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function InstituteAttendancePage() {
  const { t } = useTranslation();
  usePageTitle('institute.attendanceTitle');

  const [batches, setBatches] = useState<InstituteBatchRow[]>([]);
  const [courses, setCourses] = useState<InstituteCourseRow[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [summary, setSummary] = useState<InstituteAttendanceSummary[]>([]);
  const [entries, setEntries] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'summary' | 'mark'>('summary');

  useEffect(() => {
    Promise.all([instituteApi.listBatches(), instituteApi.listCourses()])
      .then(([br, cr]) => {
        setBatches(br.data || []);
        setCourses(cr.data || []);
      })
      .catch(() => toast.error('Failed to load batches'));
  }, []);

  const loadSummary = useCallback(() => {
    if (!selectedBatch) return;
    setLoading(true);
    instituteApi
      .attendanceSummary(selectedBatch)
      .then((r) => {
        const data = r.data || [];
        setSummary(data);
        const map = new Map<string, boolean>();
        for (const s of data) map.set(s.enrollmentId, true);
        setEntries(map);
      })
      .catch(() => toast.error('Failed to load attendance'))
      .finally(() => setLoading(false));
  }, [selectedBatch]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const togglePresent = (enrollmentId: string) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(enrollmentId, !next.get(enrollmentId));
      return next;
    });
  };

  const handleSaveBulk = async () => {
    if (!selectedBatch || !selectedDate) return;
    setSaving(true);
    try {
      const records = summary.map((s) => ({
        enrollmentId: s.enrollmentId,
        present: entries.get(s.enrollmentId) ?? true,
      }));
      await instituteApi.recordAttendanceBulk({
        batchId: selectedBatch,
        date: new Date(selectedDate).toISOString(),
        records,
      });
      toast.success('Attendance saved');
      loadSummary();
      setMode('summary');
    } catch {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const summaryColumns: DataTableColumn<InstituteAttendanceSummary>[] = useMemo(
    () => [
      {
        key: 'photo',
        header: '',
        width: '48px',
        render: (r) =>
          r.student.profilePhotoUrl ? (
            <img src={r.student.profilePhotoUrl} alt="" className="dt-thumb" loading="lazy" />
          ) : (
            <span className="dt-thumb dt-thumb--placeholder">
              {(r.student.fullName || '?').charAt(0).toUpperCase()}
            </span>
          ),
      },
      {
        key: 'code',
        header: t('institute.fieldStudentId', 'ID'),
        render: (r) => r.student.studentCode || '—',
        sortable: true,
        sortValue: (r) => r.student.studentCode ?? '',
      },
      {
        key: 'name',
        header: t('institute.colName', 'Name'),
        sortable: true,
        render: (r) => <strong>{r.student.fullName}</strong>,
        sortValue: (r) => r.student.fullName,
      },
      {
        key: 'total',
        header: t('institute.colTotalClasses', 'Total'),
        align: 'center',
        sortable: true,
        render: (r) => r.totalClasses,
        sortValue: (r) => r.totalClasses,
      },
      {
        key: 'present',
        header: t('institute.colPresent', 'Present'),
        align: 'center',
        render: (r) => <span style={{ color: '#22c55e' }}>{r.present}</span>,
      },
      {
        key: 'absent',
        header: t('institute.colAbsent', 'Absent'),
        align: 'center',
        render: (r) => <span style={{ color: r.absent > 0 ? '#ef4444' : 'inherit' }}>{r.absent}</span>,
      },
      {
        key: 'percentage',
        header: t('institute.colAttendancePct', 'Attendance %'),
        align: 'center',
        sortable: true,
        render: (r) => {
          if (r.percentage === null) return '—';
          const color = r.percentage >= 75 ? '#22c55e' : r.percentage >= 50 ? '#f59e0b' : '#ef4444';
          return <strong style={{ color }}>{r.percentage}%</strong>;
        },
        sortValue: (r) => r.percentage ?? -1,
      },
    ],
    [t]
  );

  const markColumns: DataTableColumn<InstituteAttendanceSummary>[] = useMemo(
    () => [
      {
        key: 'photo',
        header: '',
        width: '48px',
        render: (r) =>
          r.student.profilePhotoUrl ? (
            <img src={r.student.profilePhotoUrl} alt="" className="dt-thumb" loading="lazy" />
          ) : (
            <span className="dt-thumb dt-thumb--placeholder">
              {(r.student.fullName || '?').charAt(0).toUpperCase()}
            </span>
          ),
      },
      {
        key: 'name',
        header: t('institute.colName', 'Name'),
        render: (r) => <strong>{r.student.fullName}</strong>,
      },
      {
        key: 'status',
        header: t('institute.colStatus', 'Status'),
        align: 'center',
        render: (r) => {
          const isPresent = entries.get(r.enrollmentId) ?? true;
          return (
            <button
              type="button"
              className={`dt-pill ${isPresent ? 'dt-pill--active' : 'dt-pill--suspended'}`}
              style={{ cursor: 'pointer', minWidth: 80 }}
              onClick={(e) => { e.stopPropagation(); togglePresent(r.enrollmentId); }}
            >
              {isPresent ? 'Present' : 'Absent'}
            </button>
          );
        },
      },
    ],
    [t, entries]
  );

  const batchName = batches.find((b) => b.id === selectedBatch)?.name;

  return (
    <PageLayout className="page erp-list-page">
      <PageHeader
        title={t('institute.attendanceTitle', 'Attendance')}
        subtitle={t('institute.attendanceSubtitle', 'Track and manage student attendance')}
        actions={
          selectedBatch && summary.length > 0 && (
            mode === 'summary' ? (
              <button type="button" className="btn btn-primary btn-erp" onClick={() => setMode('mark')}>
                <Check size={16} aria-hidden /> Mark Attendance
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-erp" onClick={handleSaveBulk} disabled={saving}>
                <Save size={16} aria-hidden /> {saving ? 'Saving…' : 'Save Attendance'}
              </button>
            )
          )
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="input"
          style={{ maxWidth: 280 }}
          value={selectedBatch}
          onChange={(e) => { setSelectedBatch(e.target.value); setMode('summary'); }}
          aria-label="Select batch"
        >
          <option value="">Select batch…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.course?.title})
            </option>
          ))}
        </select>
        {mode === 'mark' && (
          <input
            type="date"
            className="input"
            style={{ maxWidth: 180 }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Attendance date"
          />
        )}
        {mode === 'mark' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('summary')}>
            Cancel
          </button>
        )}
      </div>

      {!selectedBatch ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          Select a batch to view attendance
        </div>
      ) : mode === 'summary' ? (
        <DataTable
          columns={summaryColumns}
          data={summary}
          keyExtractor={(r) => r.enrollmentId}
          loading={loading}
          emptyTitle="No enrollments"
          emptyDescription="This batch has no active enrollments yet"
          exportCsv={{
            filename: `attendance-${batchName ?? 'batch'}`,
            headers: ['Student ID', 'Name', 'Total', 'Present', 'Absent', '%'],
            row: (r) => [
              r.student.studentCode ?? '',
              r.student.fullName,
              r.totalClasses.toString(),
              r.present.toString(),
              r.absent.toString(),
              r.percentage !== null ? `${r.percentage}%` : '—',
            ],
          }}
          printTitle={`Attendance — ${batchName ?? 'Batch'}`}
        />
      ) : (
        <DataTable
          columns={markColumns}
          data={summary}
          keyExtractor={(r) => r.enrollmentId}
          loading={loading}
          pageSize={50}
          emptyTitle="No enrollments"
          emptyDescription="This batch has no active enrollments"
        />
      )}
    </PageLayout>
  );
}
