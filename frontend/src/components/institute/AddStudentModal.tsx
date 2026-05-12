import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ChevronDown, X } from 'lucide-react';
import { branchesApi, instituteApi, type InstituteBatchRow, type InstituteStudent } from '../../services/api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useAuth } from '../../hooks/useAuth';
import { emptyStudentForm, payloadFromStudentForm, type StudentFormValues } from '../../utils/instituteStudentForm';
import { AdmissionAdvancedFields } from './AdmissionAdvancedFields';
import { formatTimingSlot } from '../../utils/instituteTableHelpers';
import { computeTuitionPayable, resolveBatchBaseFee } from '../../utils/instituteAdmissionFee';
import { formatCurrency } from '../../utils/formatting';
import { resolveBranchInstituteFeeCurrencyDisplay } from '../../utils/branchInstituteCurrency';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (student: InstituteStudent) => void;
};

type BranchOption = {
  id: string;
  name: string;
  currency?: string | null;
  instituteFeeCurrency?: string | null;
  instituteReceiptCurrency?: string | null;
  instituteReportingCurrency?: string | null;
};

export function AddStudentModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [studentIdCard, setStudentIdCard] = useState('');
  const [guardianParentId, setGuardianParentId] = useState('');

  const [enrollImmediately, setEnrollImmediately] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountFixed, setDiscountFixed] = useState('');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedValues, setAdvancedValues] = useState<StudentFormValues>(() => emptyStudentForm());

  const [submitting, setSubmitting] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [batches, setBatches] = useState<InstituteBatchRow[]>([]);

  const patchAdvanced = useCallback((patch: Partial<StudentFormValues>) => {
    setAdvancedValues((v) => ({ ...v, ...patch }));
  }, []);

  const resetForm = useCallback(() => {
    setFirstName('');
    setLastName('');
    setStudentPhone('');
    setGuardianPhone('');
    setStudentIdCard('');
    setGuardianParentId('');
    setEnrollImmediately(false);
    setCourseId('');
    setBatchId('');
    setDiscountPercent('');
    setDiscountFixed('');
    setAdvancedOpen(false);
    setAdvancedValues(emptyStudentForm());
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
    void branchesApi
      .getAll()
      .then((r) => {
        const list = (Array.isArray(r.data) ? r.data : []) as BranchOption[];
        setBranches(list);
        const preferred =
          user?.branchId && list.some((b) => b.id === user.branchId) ? user.branchId : list[0]?.id || '';
        setBranchId(preferred);
      })
      .catch(() => {
        setBranches([]);
        setBranchId('');
      });
  }, [open, user?.branchId, resetForm]);

  useEffect(() => {
    if (!open || !enrollImmediately) {
      setCourses([]);
      setBatches([]);
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    void Promise.all([
      instituteApi.listCourses({ activeOnly: true }),
      instituteApi.listBatches(),
    ])
      .then(([cr, br]) => {
        const courseRows = cr.data || [];
        setCourses(courseRows.map((c) => ({ id: c.id, title: c.title })));
        setBatches(br.data || []);
      })
      .catch(() => {
        setCourses([]);
        setBatches([]);
      })
      .finally(() => setCatalogLoading(false));
  }, [open, enrollImmediately]);

  const batchesForCourse = useMemo(() => {
    if (!courseId) return [];
    return batches.filter((b) => b.courseId === courseId);
  }, [batches, courseId]);

  useEffect(() => {
    if (!courseId) setBatchId('');
    else if (batchId && !batchesForCourse.some((b) => b.id === batchId)) {
      setBatchId('');
    }
  }, [courseId, batchesForCourse, batchId]);

  const selectedBatch = useMemo(() => batches.find((b) => b.id === batchId) ?? null, [batches, batchId]);

  const branchCurrency = useMemo(() => {
    const b = branches.find((x) => x.id === branchId);
    const fromBranch = resolveBranchInstituteFeeCurrencyDisplay(b);
    return (
      fromBranch ||
      String(user?.branchDefaultCurrency || user?.currency || '')
        .trim()
        .toUpperCase()
    );
  }, [branches, branchId, user?.branchDefaultCurrency, user?.currency]);

  const baseTuition = useMemo(() => {
    if (!selectedBatch) return 0;
    return resolveBatchBaseFee(selectedBatch);
  }, [selectedBatch]);

  const finalPayable = useMemo(
    () => computeTuitionPayable(baseTuition, discountPercent, discountFixed),
    [baseTuition, discountPercent, discountFixed]
  );

  const timingDisplay = selectedBatch
    ? formatTimingSlot(selectedBatch.timingSlot, selectedBatch.timingLabel, t)
    : '—';

  const onDiscountPercentChange = (v: string) => {
    setDiscountPercent(v);
    if (v.trim() !== '') setDiscountFixed('');
  };

  const onDiscountFixedChange = (v: string) => {
    setDiscountFixed(v);
    if (v.trim() !== '') setDiscountPercent('');
  };

  if (!open) return null;

  const submit = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      toast.error(t('institute.admissionNameRequired'));
      return;
    }
    const fullName = `${fn} ${ln}`.trim();
    const phone = studentPhone.trim();
    const gPhone = guardianPhone.trim();
    if (!phone) {
      toast.error(t('institute.admissionStudentPhoneRequired'));
      return;
    }
    if (!gPhone) {
      toast.error(t('institute.admissionGuardianPhoneRequired'));
      return;
    }
    const gId = guardianParentId.trim();
    if (!gId) {
      toast.error(t('institute.admissionGuardianIdRequired'));
      return;
    }

    if (enrollImmediately) {
      if (!courseId || !batchId) {
        toast.error(t('institute.admissionCourseBatchRequired'));
        return;
      }
    }

    setSubmitting(true);
    try {
      const merged: StudentFormValues = {
        ...advancedValues,
        fullName,
        nationalId: studentIdCard.trim(),
        phone,
        guardianPhone: gPhone,
        identityDocumentType: 'guardian_id',
        identityDocumentNumber: gId,
      };

      const body = payloadFromStudentForm(merged, { includeStatus: false });
      const created = await instituteApi.createStudent({
        ...body,
        fullName,
        ...(branchId.trim() ? { branchId: branchId.trim() } : {}),
      });

      if (enrollImmediately && batchId) {
        const payable = finalPayable;
        await instituteApi.enroll({
          studentId: created.data.id,
          batchId,
          fees:
            payable > 0
              ? [
                  {
                    label: t('institute.feeDefaultLabel'),
                    amount: payable,
                    ...(branchCurrency ? { currency: branchCurrency } : {}),
                  },
                ]
              : undefined,
          skipAutoFee: payable <= 0,
        });
      }

      toast.success(enrollImmediately ? t('institute.admissionCreatedAndEnrolled') : t('institute.studentCreated'));
      onCreated(created.data);
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e, t('institute.studentCreateFailed')));
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
        className="institute-modal card institute-modal--wide institute-modal--admission"
        role="dialog"
        aria-modal="true"
        aria-labelledby="institute-add-student-title"
      >
        <div className="institute-modal__head">
          <h2 id="institute-add-student-title" className="institute-modal__title">
            {t('institute.admissionModalTitle')}
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
          <label className="institute-field institute-field--grid">
            <span className="institute-field__label">{t('institute.fieldBranchCampus')}</span>
            <select className="input input--lg" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('institute.branchOptional')}</option>
              {branches.map((b) => {
                const feeIso = resolveBranchInstituteFeeCurrencyDisplay(b);
                return (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {feeIso ? ` (${feeIso})` : ''}
                  </option>
                );
              })}
            </select>
          </label>

          <section className="institute-admission-primary card institute-form-section--nested">
            <h3 className="institute-admission-primary__title">{t('institute.admissionSectionBasic')}</h3>
            <div className="institute-form-grid institute-form-grid--admission">
              <label className="institute-field institute-field--grid">
                <span className="institute-field__label">{t('institute.fieldFirstName')}</span>
                <input
                  type="text"
                  className="input input--lg"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  maxLength={200}
                  required
                />
              </label>
              <label className="institute-field institute-field--grid">
                <span className="institute-field__label">{t('institute.fieldLastName')}</span>
                <input
                  type="text"
                  className="input input--lg"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  maxLength={200}
                  required
                />
              </label>
              <label className="institute-field institute-field--grid">
                <span className="institute-field__label">{t('institute.admissionStudentPhone')}</span>
                <input
                  type="tel"
                  className="input input--lg"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  autoComplete="tel"
                  maxLength={64}
                  required
                />
              </label>
              <label className="institute-field institute-field--grid">
                <span className="institute-field__label">{t('institute.admissionGuardianPhone')}</span>
                <input
                  type="tel"
                  className="input input--lg"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  autoComplete="tel"
                  maxLength={64}
                  required
                />
              </label>
              <label className="institute-field institute-field--grid">
                <span className="institute-field__label">{t('institute.admissionStudentIdCardOptional')}</span>
                <input
                  type="text"
                  className="input input--lg"
                  value={studentIdCard}
                  onChange={(e) => setStudentIdCard(e.target.value)}
                  maxLength={64}
                />
              </label>
              <label className="institute-field institute-field--grid">
                <span className="institute-field__label">{t('institute.admissionGuardianId')}</span>
                <input
                  type="text"
                  className="input input--lg"
                  value={guardianParentId}
                  onChange={(e) => setGuardianParentId(e.target.value)}
                  maxLength={128}
                  required
                />
              </label>
            </div>
          </section>

          <label className="institute-admission-toggle institute-checkbox-row">
            <input
              type="checkbox"
              checked={enrollImmediately}
              onChange={(e) => setEnrollImmediately(e.target.checked)}
            />
            <span>{t('institute.admissionEnrollImmediately')}</span>
          </label>

          {enrollImmediately ? (
            <section className="institute-admission-enroll card institute-form-section--nested">
              <h3 className="institute-admission-primary__title">{t('institute.admissionSectionEnrollment')}</h3>
              {catalogLoading ? (
                <p className="institute-admission-muted">{t('common.loading')}</p>
              ) : (
                <>
                  <div className="institute-form-grid institute-form-grid--admission">
                    <label className="institute-field institute-field--grid">
                      <span className="institute-field__label">{t('institute.fieldCourse')}</span>
                      <select className="input input--lg" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                        <option value="">{t('institute.selectCourse')}</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="institute-field institute-field--grid">
                      <span className="institute-field__label">{t('institute.fieldBatch')}</span>
                      <select
                        className="input input--lg"
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        disabled={!courseId}
                      >
                        <option value="">{t('institute.selectBatch')}</option>
                        {batchesForCourse.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {selectedBatch ? (
                    <div className="institute-modal__review institute-modal__review--admission">
                      <div className="institute-modal__review-row">
                        <span className="institute-modal__review-label">{t('institute.colTiming')}</span>
                        <span className="institute-modal__review-value">{timingDisplay}</span>
                      </div>
                      {selectedBatch.teacherName ? (
                        <div className="institute-modal__review-row">
                          <span className="institute-modal__review-label">{t('institute.fieldTeacher')}</span>
                          <span className="institute-modal__review-value">{selectedBatch.teacherName}</span>
                        </div>
                      ) : null}
                      <div className="institute-modal__review-row">
                        <span className="institute-modal__review-label">{t('institute.admissionBaseTuition')}</span>
                        <span className="institute-modal__review-value">{formatCurrency(baseTuition, branchCurrency)}</span>
                      </div>
                      <div className="institute-form-grid institute-form-grid--admission institute-form-grid--discount">
                        <label className="institute-field institute-field--grid">
                          <span className="institute-field__label">{t('institute.admissionDiscountPercent')}</span>
                          <input
                            type="text"
                            className="input input--lg"
                            inputMode="decimal"
                            placeholder="0"
                            value={discountPercent}
                            onChange={(e) => onDiscountPercentChange(e.target.value)}
                          />
                        </label>
                        <label className="institute-field institute-field--grid">
                          <span className="institute-field__label">{t('institute.admissionDiscountFixed')}</span>
                          <input
                            type="text"
                            className="input input--lg"
                            inputMode="decimal"
                            placeholder="0"
                            value={discountFixed}
                            onChange={(e) => onDiscountFixedChange(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="institute-modal__review-row institute-modal__review-row--emphasis">
                        <span className="institute-modal__review-label">{t('institute.admissionFinalPayable')}</span>
                        <span className="institute-modal__review-value">{formatCurrency(finalPayable, branchCurrency)}</span>
                      </div>
                    </div>
                  ) : courseId ? (
                    <p className="institute-admission-muted">{t('institute.admissionPickBatch')}</p>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          <div className="institute-admission-advanced-wrap">
            <button
              type="button"
              className="institute-advanced-toggle"
              onClick={() => setAdvancedOpen((o) => !o)}
              aria-expanded={advancedOpen}
            >
              <ChevronDown size={18} className={advancedOpen ? 'institute-advanced-toggle__icon--open' : undefined} />
              {t('institute.admissionAdvancedDetails')}
            </button>
            {advancedOpen ? <AdmissionAdvancedFields values={advancedValues} onChange={patchAdvanced} /> : null}
          </div>
        </div>

        <div className="institute-modal__foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? t('common.loading') : t('institute.admissionSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
