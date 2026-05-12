import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, ClipboardList, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  instituteApi,
  type InstituteExam,
  type InstituteBatchRow,
} from '../../services/api';
import { PageLayout, PageHeader, DataTable } from '../../components/design-system';
import type { DataTableColumn } from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/formatting';

const EXAM_TYPES = ['quiz', 'assignment', 'practical', 'viva', 'midterm', 'final'] as const;

const TYPE_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  assignment: 'Assignment',
  practical: 'Practical',
  viva: 'Viva',
  midterm: 'Midterm',
  final: 'Final',
};

function ExamModal({
  open,
  exam,
  batches,
  onClose,
  onSaved,
}: {
  open: boolean;
  exam: InstituteExam | null;
  batches: InstituteBatchRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!exam;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [batchId, setBatchId] = useState('');
  const [type, setType] = useState<string>('quiz');
  const [totalMarks, setTotalMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('40');
  const [examDate, setExamDate] = useState('');
  const [weightPercent, setWeightPercent] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(exam?.title ?? '');
      setBatchId(exam?.batchId ?? '');
      setType(exam?.type ?? 'quiz');
      setTotalMarks(String(exam?.totalMarks ?? 100));
      setPassingMarks(String(exam?.passingMarks ?? 40));
      setExamDate(exam?.examDate ? exam.examDate.slice(0, 10) : '');
      setWeightPercent(exam?.weightPercent != null ? String(exam.weightPercent) : '');
      setRemarks(exam?.remarks ?? '');
    }
  }, [open, exam]);

  const handleSave = async () => {
    if (!title.trim()) return toast.error('Title is required');
    if (!batchId && !isEdit) return toast.error('Batch is required');
    const tm = Number(totalMarks) || 0;
    const pm = Number(passingMarks) || 0;
    if (pm > tm) return toast.error('Passing marks cannot exceed total marks');

    setSaving(true);
    try {
      if (isEdit) {
        await instituteApi.updateExam(exam!.id, {
          title: title.trim(),
          type,
          totalMarks: tm,
          passingMarks: pm,
          examDate: examDate || undefined,
          weightPercent: weightPercent ? Number(weightPercent) : null,
          remarks: remarks.trim() || null,
        });
        toast.success('Exam updated');
      } else {
        await instituteApi.createExam({
          batchId,
          title: title.trim(),
          type,
          totalMarks: tm,
          passingMarks: pm,
          examDate: examDate || undefined,
          weightPercent: weightPercent ? Number(weightPercent) : undefined,
          remarks: remarks.trim() || undefined,
        });
        toast.success('Exam created');
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save exam');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{isEdit ? 'Edit Exam' : 'Create Exam'}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal__body" style={{ display: 'grid', gap: '0.75rem' }}>
          {!isEdit && (
            <label className="form-label">
              Batch *
              <select className="input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">Select batch...</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.course?.title ? `${b.course.title} — ` : ''}{b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="form-label">
            Title *
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm Exam" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              Type
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Exam Date
              <input className="input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <label className="form-label">
              Total Marks *
              <input className="input" type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} min={1} />
            </label>
            <label className="form-label">
              Passing Marks *
              <input className="input" type="number" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} min={0} />
            </label>
            <label className="form-label">
              Weight %
              <input className="input" type="number" value={weightPercent} onChange={(e) => setWeightPercent(e.target.value)} min={0} max={100} placeholder="Optional" />
            </label>
          </div>
          <label className="form-label">
            Remarks
            <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
        </div>
        <div className="modal__footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InstituteExamsPage() {
  usePageTitle('Exams');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [exams, setExams] = useState<InstituteExam[]>([]);
  const [batches, setBatches] = useState<InstituteBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editExam, setEditExam] = useState<InstituteExam | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filterBatchId) params.batchId = filterBatchId;
    if (filterType) params.type = filterType;
    Promise.all([
      instituteApi.listExams(params),
      instituteApi.listBatches(),
    ])
      .then(([er, br]) => {
        setExams(er.data ?? []);
        setBatches(br.data ?? []);
      })
      .catch(() => toast.error('Failed to load exams'))
      .finally(() => setLoading(false));
  }, [filterBatchId, filterType]);

  useEffect(() => { load(); }, [load]);

  const columns: DataTableColumn<InstituteExam>[] = useMemo(
    () => [
      {
        key: 'title',
        header: 'Title',
        sortable: true,
        render: (row) => <span style={{ fontWeight: 600 }}>{row.title}</span>,
        sortValue: (row) => row.title,
      },
      {
        key: 'batch',
        header: 'Batch / Course',
        sortable: true,
        hideBelow: 768,
        render: (row) => (
          <span className="dt-truncate">
            {row.batch?.course?.title ?? '—'} / {row.batch?.name ?? '—'}
          </span>
        ),
        sortValue: (row) => `${row.batch?.course?.title ?? ''} ${row.batch?.name ?? ''}`,
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        render: (row) => (
          <span className={`status-pill status-${row.type === 'final' ? 'warning' : row.type === 'midterm' ? 'info' : 'muted'}`}>
            {TYPE_LABELS[row.type] ?? row.type}
          </span>
        ),
        sortValue: (row) => row.type,
      },
      {
        key: 'marks',
        header: 'Marks',
        align: 'center' as const,
        render: (row) => (
          <span className="dt-mono">{row.passingMarks}/{row.totalMarks}</span>
        ),
        sortValue: (row) => row.totalMarks,
        sortable: true,
      },
      {
        key: 'date',
        header: 'Date',
        sortable: true,
        hideBelow: 640,
        render: (row) => row.examDate ? formatDate(row.examDate) : '—',
        sortValue: (row) => row.examDate ?? '',
      },
      {
        key: 'results',
        header: 'Results',
        align: 'center' as const,
        render: (row) => <span className="dt-mono">{row._count?.results ?? 0}</span>,
        sortValue: (row) => row._count?.results ?? 0,
        sortable: true,
      },
      {
        key: 'actions',
        header: '',
        width: '80px',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              className="btn btn-ghost btn-sm"
              title="Edit"
              onClick={(e) => { e.stopPropagation(); setEditExam(row); setModalOpen(true); }}
            >
              <Pencil size={14} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              title="Enter Marks"
              onClick={(e) => { e.stopPropagation(); navigate(`/institute/exams/${row.id}/marks`); }}
            >
              <ClipboardList size={14} />
            </button>
          </div>
        ),
      },
    ],
    [navigate]
  );

  return (
    <PageLayout>
      <PageHeader
        title={t('institute.exams', 'Exams')}
        subtitle={t('institute.examsSubtitle', 'Manage exams, assessments, and quizzes')}
      />

      <DataTable
        columns={columns}
        data={exams}
        keyExtractor={(r) => r.id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search exams..."
        searchFilter={(row, q) => {
          const lq = q.toLowerCase();
          return (
            row.title.toLowerCase().includes(lq) ||
            (row.batch?.name ?? '').toLowerCase().includes(lq) ||
            (row.batch?.course?.title ?? '').toLowerCase().includes(lq) ||
            row.type.toLowerCase().includes(lq)
          );
        }}
        toolbarActions={
          <button className="btn btn-primary btn-sm" onClick={() => { setEditExam(null); setModalOpen(true); }}>
            <Plus size={15} /> New Exam
          </button>
        }
        toolbarFilters={
          <>
            <select className="input input-sm" value={filterBatchId} onChange={(e) => setFilterBatchId(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.course?.title ? `${b.course.title} — ` : ''}{b.name}</option>
              ))}
            </select>
            <select className="input input-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ maxWidth: 140 }}>
              <option value="">All Types</option>
              {EXAM_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </>
        }
        exportCsv={{
          filename: 'exams',
          headers: ['Title', 'Course', 'Batch', 'Type', 'Total Marks', 'Passing Marks', 'Date'],
          row: (r) => [r.title, r.batch?.course?.title ?? '', r.batch?.name ?? '', TYPE_LABELS[r.type] ?? r.type, String(r.totalMarks), String(r.passingMarks), r.examDate ? formatDate(r.examDate) : ''],
        }}
        printTitle="Exams"
        emptyTitle="No exams yet"
        emptyDescription="Create your first exam to get started."
        emptyAction={
          <button className="btn btn-primary btn-sm" onClick={() => { setEditExam(null); setModalOpen(true); }}>
            <Plus size={15} /> New Exam
          </button>
        }
      />

      <ExamModal
        open={modalOpen}
        exam={editExam}
        batches={batches}
        onClose={() => { setModalOpen(false); setEditExam(null); }}
        onSaved={load}
      />
    </PageLayout>
  );
}
