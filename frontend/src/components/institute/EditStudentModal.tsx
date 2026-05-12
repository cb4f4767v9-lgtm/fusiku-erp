import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { instituteApi, type InstituteStudent } from '../../services/api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import {
  emptyStudentForm,
  payloadFromStudentForm,
  studentFormFromApi,
  type StudentFormValues,
} from '../../utils/instituteStudentForm';
import { InstituteStudentProfileForm } from './InstituteStudentProfileForm';
import { formatDate } from '../../utils/formatting';

type Props = {
  open: boolean;
  student: InstituteStudent | null;
  onClose: () => void;
  onSaved: (student: InstituteStudent) => void;
};

export function EditStudentModal({ open, student, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<StudentFormValues>(() => emptyStudentForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    setValues(studentFormFromApi(student));
    setSubmitting(false);
  }, [open, student]);

  if (!open || !student) return null;

  const patchValues = (patch: Partial<StudentFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const submit = async () => {
    const name = values.fullName.trim();
    if (!name) {
      toast.error(t('institute.studentNameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const body = payloadFromStudentForm({ ...values, fullName: name }, { includeStatus: true });
      const res = await instituteApi.updateStudent(student.id, { ...body, fullName: name });
      toast.success(t('institute.studentUpdated'));
      onSaved(res.data);
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e, t('institute.studentUpdateFailed')));
    } finally {
      setSubmitting(false);
    }
  };

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
        aria-labelledby="institute-edit-student-title"
      >
        <div className="institute-modal__head">
          <h2 id="institute-edit-student-title" className="institute-modal__title">
            {t('institute.editStudentTitle')}
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
          <InstituteStudentProfileForm
            variant="edit"
            values={values}
            onChange={patchValues}
            studentCodeDisplay={student.studentCode}
            createdAtDisplay={formatDate(student.createdAt)}
          />
        </div>
        <div className="institute-modal__foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? t('common.loading') : t('institute.saveStudent')}
          </button>
        </div>
      </div>
    </div>
  );
}
