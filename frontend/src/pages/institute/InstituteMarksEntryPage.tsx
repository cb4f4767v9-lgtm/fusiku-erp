import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  instituteApi,
  type InstituteExam,
  type InstituteExamResult,
} from '../../services/api';
import { PageLayout, PageHeader } from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';

type ResultStatus = 'pass' | 'fail' | 'absent' | 'withheld';

type RowEntry = {
  enrollmentId: string;
  studentName: string;
  studentCode: string | null;
  obtainedMarks: string;
  status: ResultStatus | '';
  remarks: string;
  existing?: InstituteExamResult;
};

function gradeFromMarks(obtained: number, total: number, passing: number): { percentage: number; grade: string; status: 'pass' | 'fail' } {
  if (total <= 0) return { percentage: 0, grade: 'F', status: 'fail' };
  const pct = Math.round((obtained / total) * 10000) / 100;
  const status = obtained >= passing ? 'pass' : 'fail';
  const scale = [
    { min: 90, g: 'A+' }, { min: 85, g: 'A' }, { min: 80, g: 'A-' },
    { min: 75, g: 'B+' }, { min: 70, g: 'B' }, { min: 65, g: 'B-' },
    { min: 60, g: 'C+' }, { min: 55, g: 'C' }, { min: 50, g: 'C-' },
    { min: 45, g: 'D' }, { min: 0, g: 'F' },
  ];
  let grade = 'F';
  for (const s of scale) { if (pct >= s.min) { grade = s.g; break; } }
  if (status === 'fail') grade = 'F';
  return { percentage: pct, grade, status };
}

export function InstituteMarksEntryPage() {
  const { examId } = useParams<{ examId: string }>();
  usePageTitle('Marks Entry');
  const [exam, setExam] = useState<InstituteExam | null>(null);
  const [rows, setRows] = useState<RowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!examId) return;
    setLoading(true);
    instituteApi.getExam(examId)
      .then(async (er) => {
        const examData = er.data;
        if (!examData) { toast.error('Exam not found'); return; }
        setExam(examData);

        const enr = await instituteApi.listEnrollments({ batchId: examData.batchId, status: 'active' });
        const enrollmentList = enr.data ?? [];

        const existingResults = examData.results ?? [];
        const resultMap = new Map<string, InstituteExamResult>();
        for (const r of existingResults) {
          resultMap.set(r.enrollmentId, r);
        }

        const rowData: RowEntry[] = enrollmentList.map((e) => {
          const existing = resultMap.get(e.id);
          return {
            enrollmentId: e.id,
            studentName: e.student?.fullName ?? '—',
            studentCode: e.student?.studentCode ?? null,
            obtainedMarks: existing ? String(existing.obtainedMarks) : '',
            status: (existing?.status as ResultStatus) || '',
            remarks: existing?.remarks ?? '',
            existing,
          };
        });
        setRows(rowData);
      })
      .catch(() => toast.error('Failed to load exam'))
      .finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  const updateRow = useCallback((idx: number, field: keyof RowEntry, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!exam) return;

    const entries = rows
      .filter((r) => r.obtainedMarks !== '' || r.status === 'absent')
      .map((r) => ({
        enrollmentId: r.enrollmentId,
        obtainedMarks: r.status === 'absent' ? 0 : Math.min(Number(r.obtainedMarks) || 0, exam.totalMarks),
        remarks: r.remarks || undefined,
        status: (r.status || undefined) as ResultStatus | undefined,
      }));

    if (entries.length === 0) {
      toast.error('No marks entered');
      return;
    }

    setSaving(true);
    try {
      await instituteApi.recordResultBulk({ examId: exam.id, results: entries });
      toast.success(`${entries.length} result(s) saved`);
      load();
    } catch {
      toast.error('Failed to save results');
    } finally {
      setSaving(false);
    }
  }, [exam, rows, load]);

  const stats = useMemo(() => {
    if (!exam) return null;
    let filled = 0, pass = 0, fail = 0, absent = 0;
    for (const r of rows) {
      if (r.obtainedMarks !== '' || r.status === 'absent') {
        filled++;
        if (r.status === 'absent') { absent++; continue; }
        const marks = Number(r.obtainedMarks) || 0;
        if (marks >= exam.passingMarks) pass++;
        else fail++;
      }
    }
    return { filled, pass, fail, absent, total: rows.length };
  }, [rows, exam]);

  if (loading) {
    return (
      <PageLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '2rem 0' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="page-skeleton-line" style={{ width: `${70 + Math.random() * 30}%`, height: 18 }} />
          ))}
        </div>
      </PageLayout>
    );
  }

  if (!exam) {
    return (
      <PageLayout>
        <PageHeader title="Exam not found" />
        <Link to="/institute/exams" className="btn btn-ghost"><ArrowLeft size={16} /> Back to Exams</Link>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Link to="/institute/exams" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            {exam.title} — Marks Entry
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
            {exam.batch?.course?.title} / {exam.batch?.name} &middot; Total: {exam.totalMarks} &middot; Pass: {exam.passingMarks}
          </p>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="status-pill status-muted">{stats.filled}/{stats.total} entered</div>
          <div className="status-pill status-success"><CheckCircle size={12} /> {stats.pass} pass</div>
          <div className="status-pill status-danger"><XCircle size={12} /> {stats.fail} fail</div>
          {stats.absent > 0 && <div className="status-pill status-warning"><MinusCircle size={12} /> {stats.absent} absent</div>}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="dt-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Student</th>
              <th style={{ width: 100 }}>Code</th>
              <th style={{ width: 120 }}>Marks</th>
              <th style={{ width: 80 }}>%</th>
              <th style={{ width: 60 }}>Grade</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 150 }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const marks = Number(row.obtainedMarks) || 0;
              const preview = row.obtainedMarks !== '' && row.status !== 'absent'
                ? gradeFromMarks(marks, exam.totalMarks, exam.passingMarks)
                : null;

              return (
                <tr key={row.enrollmentId}>
                  <td style={{ textAlign: 'center', opacity: 0.5 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{row.studentName}</td>
                  <td className="dt-mono" style={{ fontSize: '0.8rem' }}>{row.studentCode ?? '—'}</td>
                  <td>
                    <input
                      className="input input-sm"
                      type="number"
                      min={0}
                      max={exam.totalMarks}
                      value={row.obtainedMarks}
                      onChange={(e) => updateRow(idx, 'obtainedMarks', e.target.value)}
                      disabled={row.status === 'absent'}
                      placeholder={`/ ${exam.totalMarks}`}
                      style={{ width: '100%', textAlign: 'center' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          const next = document.querySelector<HTMLInputElement>(
                            `[data-marks-row="${idx + 1}"]`
                          );
                          if (next) { e.preventDefault(); next.focus(); }
                        }
                      }}
                      data-marks-row={idx}
                    />
                  </td>
                  <td className="dt-mono" style={{ textAlign: 'center' }}>
                    {preview ? `${preview.percentage}%` : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {preview ? (
                      <span className={`status-pill status-${preview.status === 'pass' ? 'success' : 'danger'}`}>
                        {preview.grade}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <select
                      className="input input-sm"
                      value={row.status}
                      onChange={(e) => updateRow(idx, 'status', e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">Auto</option>
                      <option value="absent">Absent</option>
                      <option value="withheld">Withheld</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="input input-sm"
                      value={row.remarks}
                      onChange={(e) => updateRow(idx, 'remarks', e.target.value)}
                      placeholder="Optional"
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                  No enrolled students found for this batch
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
        <Link to="/institute/exams" className="btn btn-ghost">Cancel</Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? 'Saving...' : 'Save All Results'}
        </button>
      </div>
    </PageLayout>
  );
}
