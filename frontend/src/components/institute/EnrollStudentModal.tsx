import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { instituteApi, type InstituteBatchRow, type InstituteStudent } from '../../services/api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { formatTimingSlot } from '../../utils/instituteTableHelpers';

type Props = {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
  /** When set, the student select is pre-filled and disabled (profile page). */
  defaultStudentId?: string;
};

export function EnrollStudentModal({ open, onClose, onEnrolled, defaultStudentId }: Props) {
  const { t } = useTranslation();
  const [students, setStudents] = useState<InstituteStudent[]>([]);
  const [batches, setBatches] = useState<InstituteBatchRow[]>([]);
  const [studentId, setStudentId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudentId(defaultStudentId ?? '');
    setBatchId('');
    setAdmissionDate('');
    setExpectedCompletionDate('');
    void Promise.all([
      instituteApi.listStudents().then((r) => setStudents(r.data || [])),
      instituteApi.listBatches().then((r) => setBatches(r.data || [])),
    ]).catch(() => {
      setStudents([]);
      setBatches([]);
    });
  }, [open, defaultStudentId]);

  useEffect(() => {
    if (!batchId || !batches.length) return;
    const b = batches.find((x) => x.id === batchId);
    if (b?.endsOn) {
      setExpectedCompletionDate(String(b.endsOn).slice(0, 10));
    } else {
      setExpectedCompletionDate('');
    }
  }, [batchId, batches]);

  if (!open) return null;

  const submit = async () => {
    if (!studentId || !batchId) {
      toast.error(t('institute.enrollSelectBoth'));
      return;
    }
    setSubmitting(true);
    try {
      await instituteApi.enroll({
        studentId,
        batchId,
        ...(admissionDate.trim() ? { admissionDate: `${admissionDate.trim()}T12:00:00.000Z` } : {}),
        ...(expectedCompletionDate.trim()
          ? { expectedCompletionDate: `${expectedCompletionDate.trim()}T12:00:00.000Z` }
          : {}),
      });
      toast.success(t('institute.enrollSuccess'));
      onEnrolled();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e, t('institute.enrollFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBatch = batches.find((b) => b.id === batchId);

  return (
    <div
      className="institute-modal-backdrop institute-modal-backdrop--premium"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="institute-modal card institute-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="institute-enroll-title"
      >
        <div className="institute-modal__head">
          <h2 id="institute-enroll-title" className="institute-modal__title">
            {t('institute.enrollTitle')}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm institute-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="institute-modal__body institute-modal__body--scroll">
          <p className="institute-enroll-explainer">{t('institute.enrollExplainer')}</p>
          <label className="institute-field">
            <span className="institute-field__label">{t('institute.fieldStudent')}</span>
            <select
              className="input"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={Boolean(defaultStudentId)}
            >
              {!defaultStudentId ? <option value="">{t('institute.selectStudent')}</option> : null}
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                  {s.studentCode ? ` (${s.studentCode})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="institute-field">
            <span className="institute-field__label">{t('institute.fieldBatch')}</span>
            <select className="input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">{t('institute.selectBatch')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.course?.title ?? '—'} — {b.name}
                  {b.timingLabel ? ` (${b.timingLabel})` : b.timingSlot ? ` (${b.timingSlot})` : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedBatch ? (
            <p className="institute-enroll-batch-meta">
              {formatTimingSlot(selectedBatch.timingSlot, selectedBatch.timingLabel, t)}
              {selectedBatch.teacherName ? ` · ${selectedBatch.teacherName}` : ''}
              {selectedBatch.capacity != null ? ` · ${t('institute.capacity')}: ${selectedBatch.capacity}` : ''}
            </p>
          ) : null}
          <div className="institute-form-grid institute-enroll-dates">
            <label className="institute-field institute-field--grid">
              <span className="institute-field__label">{t('institute.admissionDate')}</span>
              <input
                type="date"
                className="input"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
              />
            </label>
            <label className="institute-field institute-field--grid">
              <span className="institute-field__label">{t('institute.expectedCompletionDate')}</span>
              <input
                type="date"
                className="input"
                value={expectedCompletionDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="institute-modal__foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? t('common.loading') : t('institute.enrollSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
