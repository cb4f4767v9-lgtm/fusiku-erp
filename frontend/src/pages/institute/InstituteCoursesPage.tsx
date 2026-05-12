import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, Check, X } from 'lucide-react';
import {
  instituteApi,
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
  title: string;
  code: string;
  description: string;
  defaultFee: string;
  active: boolean;
};

const emptyForm: FormValues = { title: '', code: '', description: '', defaultFee: '', active: true };

export function InstituteCoursesPage() {
  const { t } = useTranslation();
  usePageTitle('institute.coursesTitle');

  const [courses, setCourses] = useState<InstituteCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    instituteApi
      .listCourses()
      .then((r) => setCourses(r.data || []))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (c: InstituteCourseRow) => {
    setEditId(c.id);
    setForm({
      title: c.title,
      code: c.code ?? '',
      description: c.description ?? '',
      defaultFee: c.defaultFee ?? '',
      active: c.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const fee = form.defaultFee.trim() ? Number(form.defaultFee) : undefined;
      if (editId) {
        await instituteApi.updateCourse(editId, {
          title: form.title.trim(),
          code: form.code.trim() || undefined,
          description: form.description.trim() || undefined,
          active: form.active,
          defaultFee: fee === undefined ? null : fee,
        });
        toast.success('Course updated');
      } else {
        await instituteApi.createCourse({
          title: form.title.trim(),
          code: form.code.trim() || undefined,
          description: form.description.trim() || undefined,
          active: form.active,
          defaultFee: fee,
        });
        toast.success('Course created');
      }
      setShowForm(false);
      load();
    } catch {
      toast.error('Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<InstituteCourseRow>[] = useMemo(
    () => [
      {
        key: 'code',
        header: t('institute.colCode', 'Code'),
        sortable: true,
        width: '100px',
        render: (r) => <span className="dt-mono">{r.code || '—'}</span>,
        sortValue: (r) => r.code ?? '',
      },
      {
        key: 'title',
        header: t('institute.colTitle', 'Title'),
        sortable: true,
        render: (r) => <strong>{r.title}</strong>,
        sortValue: (r) => r.title,
      },
      {
        key: 'description',
        header: t('institute.colDescription', 'Description'),
        hideBelow: 1024,
        render: (r) => (
          <span className="dt-truncate" style={{ maxWidth: 280 }}>
            {r.description || '—'}
          </span>
        ),
      },
      {
        key: 'defaultFee',
        header: t('institute.colDefaultFee', 'Default Fee'),
        align: 'right',
        sortable: true,
        render: (r) =>
          r.defaultFee ? formatCurrency(Number(r.defaultFee), '') : '—',
        sortValue: (r) => (r.defaultFee ? Number(r.defaultFee) : 0),
      },
      {
        key: 'batches',
        header: t('institute.colBatches', 'Batches'),
        align: 'center',
        sortable: true,
        render: (r) => (r as any)._count?.batches ?? '—',
        sortValue: (r) => (r as any)._count?.batches ?? 0,
      },
      {
        key: 'active',
        header: t('institute.colActive', 'Status'),
        align: 'center',
        render: (r) => (
          <span className={`dt-pill dt-pill--${r.active ? 'active' : 'inactive'}`}>
            {r.active ? 'Active' : 'Inactive'}
          </span>
        ),
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
        title={t('institute.coursesTitle', 'Courses')}
        subtitle={t('institute.coursesSubtitle', 'Manage institute courses and programs')}
        actions={
          <button type="button" className="btn btn-primary btn-erp" onClick={openCreate}>
            <Plus size={16} aria-hidden /> {t('institute.addCourse', 'Add Course')}
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={courses}
        keyExtractor={(r) => r.id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('institute.searchCourses', 'Search courses…')}
        searchFilter={(r, q) =>
          r.title.toLowerCase().includes(q) ||
          (r.code ?? '').toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q)
        }
        onRowClick={openEdit}
        emptyTitle={t('institute.coursesEmpty', 'No courses yet')}
        emptyDescription={t('institute.coursesEmptyHint', 'Create your first course to get started')}
        emptyAction={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} aria-hidden /> {t('institute.addCourse', 'Add Course')}
          </button>
        }
        exportCsv={{
          filename: 'courses',
          headers: ['Code', 'Title', 'Default Fee', 'Status'],
          row: (r) => [r.code ?? '', r.title, r.defaultFee ?? '', r.active ? 'Active' : 'Inactive'],
        }}
        printTitle="Courses"
      />

      {/* Inline form modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editId ? 'Edit Course' : 'New Course'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="form-label">
                Title *
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="form-label">
                Code
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. CS-101"
                />
              </label>
              <label className="form-label">
                Description
                <textarea
                  className="input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="form-label">
                Default Fee
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.defaultFee}
                  onChange={(e) => setForm((f) => ({ ...f, defaultFee: e.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label className="form-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active
              </label>
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
