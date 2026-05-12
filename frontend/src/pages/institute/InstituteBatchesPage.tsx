import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check, X, Users } from 'lucide-react';
import {
  instituteApi,
  type InstituteBatchRow,
  type InstituteCourseRow,
} from '../../services/api';
import {
  PageLayout,
  PageHeader,
  DataTable,
  type DataTableColumn,
} from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatCurrency } from '../../utils/formatting';
import toast from 'react-hot-toast';

type FormValues = {
  courseId: string;
  name: string;
  timingSlot: string;
  timingLabel: string;
  teacherName: string;
  capacity: string;
  feeOverride: string;
  startsOn: string;
  endsOn: string;
};

const emptyForm: FormValues = {
  courseId: '',
  name: '',
  timingSlot: '',
  timingLabel: '',
  teacherName: '',
  capacity: '',
  feeOverride: '',
  startsOn: '',
  endsOn: '',
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
}

function formatTiming(slot: string | null | undefined, label: string | null | undefined): string {
  const parts: string[] = [];
  if (slot) parts.push(slot.charAt(0).toUpperCase() + slot.slice(1));
  if (label) parts.push(label);
  return parts.join(' · ') || '—';
}

export function InstituteBatchesPage() {
  const { t } = useTranslation();
  usePageTitle('institute.batchesTitle');

  const [batches, setBatches] = useState<InstituteBatchRow[]>([]);
  const [courses, setCourses] = useState<InstituteCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([instituteApi.listBatches(), instituteApi.listCourses()])
      .then(([br, cr]) => {
        setBatches(br.data || []);
        setCourses(cr.data || []);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (courseFilter === 'all') return batches;
    return batches.filter((b) => b.courseId === courseFilter);
  }, [batches, courseFilter]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (b: InstituteBatchRow) => {
    setEditId(b.id);
    setForm({
      courseId: b.courseId,
      name: b.name,
      timingSlot: b.timingSlot ?? '',
      timingLabel: b.timingLabel ?? '',
      teacherName: b.teacherName ?? '',
      capacity: b.capacity?.toString() ?? '',
      feeOverride: b.feeOverride ?? '',
      startsOn: b.startsOn ? b.startsOn.split('T')[0] : '',
      endsOn: b.endsOn ? b.endsOn.split('T')[0] : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Batch name is required'); return; }
    if (!editId && !form.courseId) { toast.error('Course is required'); return; }
    setSaving(true);
    try {
      const fee = form.feeOverride.trim() ? Number(form.feeOverride) : undefined;
      const cap = form.capacity.trim() ? Number(form.capacity) : undefined;
      if (editId) {
        await instituteApi.updateBatch(editId, {
          name: form.name.trim(),
          timingSlot: form.timingSlot || undefined,
          timingLabel: form.timingLabel || undefined,
          teacherName: form.teacherName || undefined,
          capacity: cap,
          feeOverride: fee === undefined ? null : fee,
          startsOn: form.startsOn || undefined,
          endsOn: form.endsOn || undefined,
        });
        toast.success('Batch updated');
      } else {
        await instituteApi.createBatch({
          courseId: form.courseId,
          name: form.name.trim(),
          timingSlot: form.timingSlot || undefined,
          timingLabel: form.timingLabel || undefined,
          teacherName: form.teacherName || undefined,
          capacity: cap,
          feeOverride: fee,
          startsOn: form.startsOn || undefined,
          endsOn: form.endsOn || undefined,
        });
        toast.success('Batch created');
      }
      setShowForm(false);
      load();
    } catch {
      toast.error('Failed to save batch');
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<InstituteBatchRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('institute.colBatchName', 'Batch'),
        sortable: true,
        render: (r) => <strong>{r.name}</strong>,
        sortValue: (r) => r.name,
      },
      {
        key: 'course',
        header: t('institute.colCourse', 'Course'),
        sortable: true,
        render: (r) => r.course?.title ?? '—',
        sortValue: (r) => r.course?.title ?? '',
      },
      {
        key: 'timing',
        header: t('institute.colTiming', 'Timing'),
        hideBelow: 768,
        render: (r) => formatTiming(r.timingSlot, r.timingLabel),
      },
      {
        key: 'teacher',
        header: t('institute.colTeacher', 'Teacher'),
        hideBelow: 1024,
        render: (r) => r.teacherName || '—',
      },
      {
        key: 'capacity',
        header: t('institute.colCapacity', 'Capacity'),
        align: 'center',
        sortable: true,
        render: (r) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Users size={14} style={{ opacity: 0.5 }} />
            {r.capacity ?? '—'}
          </span>
        ),
        sortValue: (r) => r.capacity ?? 0,
      },
      {
        key: 'fee',
        header: t('institute.colFee', 'Fee Override'),
        align: 'right',
        sortable: true,
        render: (r) =>
          r.feeOverride ? formatCurrency(Number(r.feeOverride), '') : '—',
        sortValue: (r) => (r.feeOverride ? Number(r.feeOverride) : 0),
      },
      {
        key: 'dates',
        header: t('institute.colDates', 'Start / End'),
        hideBelow: 1200,
        render: (r) => `${formatDate(r.startsOn)} — ${formatDate(r.endsOn)}`,
      },
      {
        key: 'actions',
        header: '',
        width: '60px',
        render: (r) => (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
          >
            Edit
          </button>
        ),
      },
    ],
    [t]
  );

  return (
    <PageLayout className="page erp-list-page">
      <PageHeader
        title={t('institute.batchesTitle', 'Batches')}
        subtitle={t('institute.batchesSubtitle', 'Manage class batches and schedules')}
        actions={
          <button type="button" className="btn btn-primary btn-erp" onClick={openCreate}>
            <Plus size={16} aria-hidden /> {t('institute.addBatch', 'Add Batch')}
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(r) => r.id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('institute.searchBatches', 'Search batches…')}
        searchFilter={(r, q) =>
          r.name.toLowerCase().includes(q) ||
          (r.course?.title ?? '').toLowerCase().includes(q) ||
          (r.teacherName ?? '').toLowerCase().includes(q)
        }
        toolbarFilters={
          <select
            className="input"
            style={{ maxWidth: 200 }}
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            aria-label="Filter by course"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        }
        onRowClick={openEdit}
        emptyTitle={t('institute.batchesEmpty', 'No batches yet')}
        emptyDescription={t('institute.batchesEmptyHint', 'Create a batch for your courses')}
        emptyAction={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} aria-hidden /> {t('institute.addBatch', 'Add Batch')}
          </button>
        }
        exportCsv={{
          filename: 'batches',
          headers: ['Batch', 'Course', 'Timing', 'Teacher', 'Capacity', 'Fee Override'],
          row: (r) => [
            r.name,
            r.course?.title ?? '',
            formatTiming(r.timingSlot, r.timingLabel),
            r.teacherName ?? '',
            r.capacity?.toString() ?? '',
            r.feeOverride ?? '',
          ],
        }}
        printTitle="Batches"
      />

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editId ? 'Edit Batch' : 'New Batch'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!editId && (
                <label className="form-label">
                  Course *
                  <select
                    className="input"
                    value={form.courseId}
                    onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                  >
                    <option value="">Select course…</option>
                    {courses.filter((c) => c.active).map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="form-label">
                Batch Name *
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="form-label">
                  Timing Slot
                  <select
                    className="input"
                    value={form.timingSlot}
                    onChange={(e) => setForm((f) => ({ ...f, timingSlot: e.target.value }))}
                  >
                    <option value="">—</option>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                    <option value="weekend">Weekend</option>
                  </select>
                </label>
                <label className="form-label">
                  Timing Label
                  <input
                    className="input"
                    value={form.timingLabel}
                    onChange={(e) => setForm((f) => ({ ...f, timingLabel: e.target.value }))}
                    placeholder="e.g. 9 AM – 12 PM"
                  />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="form-label">
                  Teacher
                  <input
                    className="input"
                    value={form.teacherName}
                    onChange={(e) => setForm((f) => ({ ...f, teacherName: e.target.value }))}
                  />
                </label>
                <label className="form-label">
                  Capacity
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  />
                </label>
              </div>
              <label className="form-label">
                Fee Override
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.feeOverride}
                  onChange={(e) => setForm((f) => ({ ...f, feeOverride: e.target.value }))}
                  placeholder="Leave blank to use course default"
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="form-label">
                  Start Date
                  <input
                    className="input"
                    type="date"
                    value={form.startsOn}
                    onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
                  />
                </label>
                <label className="form-label">
                  End Date
                  <input
                    className="input"
                    type="date"
                    value={form.endsOn}
                    onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Check size={16} aria-hidden /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
