import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, UserPlus, GraduationCap, BookOpen, BarChart3, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  instituteApi,
  type InstituteEnrollment,
  type InstituteFeeCharge,
  type InstituteStudent,
  type InstituteAcademicSummary,
  type InstituteAttendanceSummary,
} from '../../services/api';
import { PageLayout, PageHeader, TableWrapper, ErrorState, TableSkeleton } from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';
import { instituteParseAxiosError, type InstituteLoadError } from '../../utils/instituteLoadUi';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { buildInstituteFeeLedger, type InstituteLedgerRow } from '../../utils/buildInstituteLedger';
import { instituteDec } from '../../utils/instituteMoney';
import { EnrollStudentModal } from '../../components/institute/EnrollStudentModal';
import { EditStudentModal } from '../../components/institute/EditStudentModal';
import { RecordPaymentModal } from '../../components/institute/RecordPaymentModal';
import { computeAgeFromYmd } from '../../utils/instituteStudentForm';
import { useAuth } from '../../hooks/useAuth';
import i18n from '../../i18n';

export function InstituteStudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [student, setStudent] = useState<InstituteStudent | null>(null);
  const [enrollments, setEnrollments] = useState<InstituteEnrollment[]>([]);
  const [fees, setFees] = useState<InstituteFeeCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<InstituteLoadError | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payFee, setPayFee] = useState<InstituteFeeCharge | null>(null);
  const [academicTab, setAcademicTab] = useState<'overview' | 'exams' | 'results' | 'attendance'>('overview');
  const [academic, setAcademic] = useState<InstituteAcademicSummary | null>(null);
  const [attendanceSummaries, setAttendanceSummaries] = useState<InstituteAttendanceSummary[]>([]);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!studentId) return;
      setLoadError(null);
      if (!opts?.silent) setLoading(true);
      void Promise.all([
        instituteApi.getStudent(studentId),
        instituteApi.listEnrollments({ studentId }),
        instituteApi.listFees({ studentId }),
        instituteApi.academicSummary(studentId).catch(() => ({ data: null })),
      ])
        .then(([sr, er, fr, ar]) => {
          setStudent(sr.data || null);
          setEnrollments(er.data || []);
          setFees(fr.data || []);
          setAcademic(ar.data || null);
          if (!sr.data) {
            setLoadError({ title: i18n.t('institute.studentNotFound') });
          }
          // Load attendance summaries for each unique batch
          const batchIds = [...new Set((er.data ?? []).map((e: InstituteEnrollment) => e.batchId).filter(Boolean))];
          if (batchIds.length > 0) {
            Promise.all(batchIds.map((bid: string) => instituteApi.attendanceSummary(bid).catch(() => ({ data: [] }))))
              .then((results) => {
                const all = results.flatMap((r) => r.data ?? []);
                const enrollmentIds = new Set((er.data ?? []).map((e: InstituteEnrollment) => e.id));
                setAttendanceSummaries(all.filter((a: InstituteAttendanceSummary) => enrollmentIds.has(a.enrollmentId)));
              });
          }
        })
        .catch((e: unknown) => {
          setLoadError(instituteParseAxiosError(e, i18n.t('common.unableToLoadData')));
          setStudent(null);
          setEnrollments([]);
          setFees([]);
        })
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [studentId]
  );

  useEffect(() => {
    load();
  }, [load]);

  usePageTitle('institute.profileTitle', { name: student?.fullName?.trim() || t('institute.studentsTitle') });

  const ledger = useMemo(() => buildInstituteFeeLedger(fees), [fees]);
  const primaryCurrency = (
    fees[0]?.currency ||
    user?.branchDefaultCurrency ||
    user?.currency ||
    ''
  )
    .toString()
    .trim()
    .toUpperCase();

  const summary = useMemo(() => {
    let total = 0;
    let paid = 0;
    for (const f of fees) {
      total += instituteDec(f.amount);
      paid += instituteDec(f.paidAmount);
    }
    const balance = total - paid;
    return { total, paid, balance };
  }, [fees]);

  const balanceDue = summary.balance > 0.0001;

  const dobYmd = student?.dateOfBirth ? String(student.dateOfBirth).slice(0, 10) : '';
  const age = dobYmd ? computeAgeFromYmd(dobYmd) : null;

  const afterPayment = () => {
    toast.success(t('institute.ledgerRefreshed'));
    load({ silent: true });
  };

  if (!studentId) {
    return (
      <PageLayout className="page">
        <p className="muted">{t('institute.studentNotFound')}</p>
      </PageLayout>
    );
  }

  if (loading && !student) {
    return (
      <PageLayout className="page institute-profile">
        <div className="institute-profile__toolbar">
          <Link to="/institute/students" className="institute-back-link">
            <ArrowLeft size={16} aria-hidden /> {t('institute.backToStudents')}
          </Link>
          <span className="page-skeleton-line page-skeleton-line--short institute-profile-skeleton__btn" aria-hidden />
        </div>
        <div className="institute-profile-skeleton__header" aria-busy="true">
          <span className="page-skeleton-line page-skeleton-line--title" />
          <span className="page-skeleton-line page-skeleton-line--subtitle" />
        </div>
        <TableWrapper className="table-wrapper--sticky">
          <TableSkeleton rows={8} cols={4} />
        </TableWrapper>
      </PageLayout>
    );
  }

  if (loadError) {
    return (
      <PageLayout className="page institute-profile">
        <Link to="/institute/students" className="institute-back-link">
          <ArrowLeft size={16} aria-hidden /> {t('institute.backToStudents')}
        </Link>
        <ErrorState
          message={loadError.title}
          hint={loadError.hint}
          technicalDetails={loadError.technicalDetails}
          onRetry={() => load()}
        />
      </PageLayout>
    );
  }

  if (!student) {
    return null;
  }

  const renderVal = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : '—');

  const genderLabel = (g: string | null | undefined) => {
    const x = String(g || '').toLowerCase();
    if (x === 'female') return t('institute.genderFemale');
    if (x === 'male') return t('institute.genderMale');
    if (x === 'other') return t('institute.genderOther');
    if (x === 'unspecified') return t('institute.genderUnspecified');
    return renderVal(g);
  };

  const idTypeLabel = (ty: string | null | undefined) => {
    const x = String(ty || '').toLowerCase();
    if (x === 'student_id') return t('institute.idTypeStudent');
    if (x === 'father_id') return t('institute.idTypeFather');
    if (x === 'mother_id') return t('institute.idTypeMother');
    if (x === 'guardian_id') return t('institute.idTypeGuardian');
    if (x === 'passport') return t('institute.idTypePassport');
    if (x === 'legacy') return t('institute.idTypeLegacy');
    return renderVal(ty);
  };

  return (
    <PageLayout className="page institute-profile">
      <div className="institute-profile__toolbar">
        <Link to="/institute/students" className="institute-back-link">
          <ArrowLeft size={16} aria-hidden /> {t('institute.backToStudents')}
        </Link>
        <div className="institute-profile__toolbar-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
            <Pencil size={16} aria-hidden />
            {t('institute.editStudent')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEnrollOpen(true)}>
            <UserPlus size={16} aria-hidden />
            {t('institute.enrollButton')}
          </button>
        </div>
      </div>

      <header className="institute-profile__hero card">
        {student.profilePhotoUrl ? (
          <img
            src={student.profilePhotoUrl}
            alt=""
            className="institute-profile__avatar"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="institute-profile__avatar institute-profile__avatar--placeholder" aria-hidden>
            {student.fullName.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className="institute-profile__hero-text">
          <h1 className="institute-profile__name">{student.fullName}</h1>
          <p className="institute-profile__meta-row">
            <span className="institute-profile__id-pill">{student.studentCode || t('institute.pendingId')}</span>
            <span className={`institute-pill institute-pill--${String(student.status).toLowerCase()}`}>
              {student.status}
            </span>
          </p>
          <p className="institute-profile__subtitle">{t('institute.profileSubtitle')}</p>
        </div>
      </header>

      <section className="institute-summary" aria-label={t('institute.financialSummary')}>
        <div className="institute-summary__tile card institute-summary__tile--total">
          <span className="institute-summary__label">{t('institute.summaryTotal')}</span>
          <span className="institute-summary__value">{formatCurrency(summary.total, primaryCurrency)}</span>
        </div>
        <div className="institute-summary__tile card institute-summary__tile--paid">
          <span className="institute-summary__label">{t('institute.summaryPaid')}</span>
          <span className="institute-summary__value">{formatCurrency(summary.paid, primaryCurrency)}</span>
        </div>
        <div
          className={`institute-summary__tile card ${
            balanceDue ? 'institute-summary__tile--due' : 'institute-summary__tile--zero'
          }`}
        >
          <span className="institute-summary__label">{t('institute.summaryBalance')}</span>
          <span className="institute-summary__value">{formatCurrency(summary.balance, primaryCurrency)}</span>
        </div>
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.secPersonal')}</h3>
        <dl className="institute-dl institute-dl--grid">
          <div>
            <dt>{t('institute.fieldGender')}</dt>
            <dd>{genderLabel(student.gender)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldDob')}</dt>
            <dd>{student.dateOfBirth ? formatDate(student.dateOfBirth) : '—'}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldAge')}</dt>
            <dd>{age !== null ? String(age) : '—'}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldIdType')}</dt>
            <dd>{idTypeLabel(student.identityDocumentType || (student.nationalId ? 'legacy' : ''))}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldIdNumber')}</dt>
            <dd>{renderVal(student.identityDocumentNumber || student.nationalId)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldBloodGroup')}</dt>
            <dd>{renderVal(student.bloodGroup)}</dd>
          </div>
        </dl>
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.secContact')}</h3>
        <dl className="institute-dl institute-dl--grid">
          <div>
            <dt>{t('institute.colPhone')}</dt>
            <dd>{renderVal(student.phone)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldWhatsApp')}</dt>
            <dd>{renderVal(student.whatsApp)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldEmail')}</dt>
            <dd>{renderVal(student.email)}</dd>
          </div>
          <div className="institute-dl--span2">
            <dt>{t('institute.fieldAddress')}</dt>
            <dd>{renderVal(student.addressLine)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldCity')}</dt>
            <dd>{renderVal(student.city)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldCountry')}</dt>
            <dd>{renderVal(student.country)}</dd>
          </div>
        </dl>
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.secGuardian')}</h3>
        <dl className="institute-dl institute-dl--grid">
          <div>
            <dt>{t('institute.fieldFather')}</dt>
            <dd>{renderVal(student.fatherName)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldMother')}</dt>
            <dd>{renderVal(student.motherName)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldGuardian')}</dt>
            <dd>{renderVal(student.guardianName)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldEmergency')}</dt>
            <dd>{renderVal(student.emergencyContact)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldGuardianPhone')}</dt>
            <dd>{renderVal(student.guardianPhone)}</dd>
          </div>
        </dl>
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.secEducation')}</h3>
        <dl className="institute-dl institute-dl--grid">
          <div>
            <dt>{t('institute.fieldPrevSchool')}</dt>
            <dd>{renderVal(student.previousSchool)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldQualification')}</dt>
            <dd>{renderVal(student.qualification)}</dd>
          </div>
          <div className="institute-dl--span2">
            <dt>{t('institute.fieldNotes')}</dt>
            <dd className="institute-dl__multiline">{renderVal(student.notes)}</dd>
          </div>
        </dl>
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.secSystem')}</h3>
        <dl className="institute-dl institute-dl--grid">
          <div>
            <dt>{t('institute.fieldStudentId')}</dt>
            <dd>{renderVal(student.studentCode)}</dd>
          </div>
          <div>
            <dt>{t('institute.fieldCreatedAt')}</dt>
            <dd>{formatDate(student.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.sectionEnrollments')}</h3>
        {enrollments.length === 0 ? (
          <p className="muted">{t('institute.noEnrollments')}</p>
        ) : (
          <TableWrapper className="table-wrapper--sticky">
            <table className="data-table erp-table-compact institute-table-premium">
              <thead>
                <tr>
                  <th>{t('institute.enrollmentCourse')}</th>
                  <th>{t('institute.enrollmentBatch')}</th>
                  <th>{t('institute.colStatus')}</th>
                  <th>{t('institute.enrollmentDate')}</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td>{e.batch?.course?.title ?? '—'}</td>
                    <td>{e.batch?.name ?? '—'}</td>
                    <td>{e.status}</td>
                    <td>{formatDate(e.enrolledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.sectionLedger')}</h3>
        {ledger.length === 0 ? (
          <p className="muted">{t('institute.noLedger')}</p>
        ) : (
          <TableWrapper className="table-wrapper--sticky">
            <table className="data-table erp-table-compact institute-ledger institute-table-premium">
              <thead>
                <tr>
                  <th>{t('institute.ledgerDate')}</th>
                  <th>{t('institute.ledgerType')}</th>
                  <th>{t('institute.ledgerDescription')}</th>
                  <th className="num">{t('institute.ledgerDebit')}</th>
                  <th className="num">{t('institute.ledgerCredit')}</th>
                  <th className="num">{t('institute.ledgerRunning')}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row: InstituteLedgerRow) => {
                  const runDue = row.running > 0.0001;
                  const runClass = `num institute-amount${runDue ? ' institute-amount--due' : ' institute-amount--zero'}`;
                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.at)}</td>
                      <td>
                        <span className={`institute-pill institute-pill--${row.kind}`}>
                          {row.kind === 'fee' ? t('institute.ledgerFee') : t('institute.ledgerPayment')}
                        </span>
                      </td>
                      <td>{row.description}</td>
                      <td className="num institute-amount-debit">
                        {row.debit > 0 ? formatCurrency(row.debit, row.currency) : '—'}
                      </td>
                      <td className="num institute-amount-credit">
                        {row.credit > 0 ? formatCurrency(row.credit, row.currency) : '—'}
                      </td>
                      <td className={runClass}>{formatCurrency(row.running, row.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title">{t('institute.sectionOpenFees')}</h3>
        {fees.filter((f) => instituteDec(f.balance) > 0.0001).length === 0 ? (
          <p className="muted">{t('institute.noOpenFees')}</p>
        ) : (
          <TableWrapper className="table-wrapper--sticky">
            <table className="data-table erp-table-compact institute-table-premium">
              <thead>
                <tr>
                  <th>{t('institute.feeLabel')}</th>
                  <th className="num">{t('institute.colBalance')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {fees
                  .filter((f) => instituteDec(f.balance) > 0.0001)
                  .map((f) => (
                    <tr key={f.id}>
                      <td>{f.label || t('institute.feeDefaultLabel')}</td>
                      <td className="num">{formatCurrency(instituteDec(f.balance), f.currency || primaryCurrency)}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPayFee(f)}>
                          {t('institute.recordPaymentShort')}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableWrapper>
        )}
      </section>

      <section className="card institute-section">
        <h3 className="institute-section__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <GraduationCap size={18} /> Academic Profile
        </h3>

        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {([
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'exams', label: 'Exams', icon: BookOpen },
            { key: 'results', label: 'Results', icon: GraduationCap },
            { key: 'attendance', label: 'Attendance', icon: Calendar },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`btn btn-sm ${academicTab === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAcademicTab(key)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {academicTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {academic?.overallGpa != null ? academic.overallGpa.toFixed(2) : '—'}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Overall GPA</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {academic?.enrollments.reduce((s, e) => s + e.totalExams, 0) ?? 0}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Total Exams</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                  {academic?.enrollments.reduce((s, e) => s + e.passed, 0) ?? 0}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Passed</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                  {academic?.enrollments.reduce((s, e) => s + e.failed, 0) ?? 0}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Failed</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {attendanceSummaries.length > 0
                    ? `${Math.round(attendanceSummaries.reduce((s, a) => s + (a.percentage ?? 0), 0) / attendanceSummaries.length)}%`
                    : '—'}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Avg Attendance</div>
              </div>
            </div>
            {academic && academic.enrollments.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Enrollment GPA Breakdown</h4>
                {academic.enrollments.map((es) => (
                  <div key={es.enrollmentId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{es.course} / {es.batch}</span>
                    <span className="dt-mono">{es.gpa != null ? es.gpa.toFixed(2) : '—'} GPA &middot; {es.totalExams} exams</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {academicTab === 'exams' && (
          <div>
            {(!academic || academic.enrollments.every((e) => e.results.length === 0)) ? (
              <p className="muted">No exam records found.</p>
            ) : (
              <TableWrapper className="table-wrapper--sticky">
                <table className="data-table erp-table-compact institute-table-premium">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Type</th>
                      <th>Course / Batch</th>
                      <th className="num">Marks</th>
                      <th className="num">%</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academic?.enrollments.flatMap((es) =>
                      es.results.map((r) => (
                        <tr key={r.exam?.id ?? r.examId}>
                          <td style={{ fontWeight: 600 }}>{r.exam?.title ?? '—'}</td>
                          <td>
                            <span className="status-pill status-muted" style={{ textTransform: 'capitalize' }}>
                              {r.exam?.type ?? '—'}
                            </span>
                          </td>
                          <td>{es.course} / {es.batch}</td>
                          <td className="num dt-mono">{r.obtainedMarks}/{r.exam?.totalMarks ?? '?'}</td>
                          <td className="num dt-mono">{Number(r.percentage).toFixed(1)}%</td>
                          <td>
                            <span className={`status-pill status-${r.status === 'pass' ? 'success' : r.status === 'fail' ? 'danger' : 'warning'}`}>
                              {r.grade ?? '—'}
                            </span>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{r.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrapper>
            )}
          </div>
        )}

        {academicTab === 'results' && (
          <div>
            {(!academic || academic.enrollments.length === 0) ? (
              <p className="muted">No results available.</p>
            ) : (
              academic.enrollments.map((es) => (
                <div key={es.enrollmentId} style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    {es.course} / {es.batch}
                    <span style={{ marginLeft: '0.75rem', fontWeight: 400, opacity: 0.6 }}>
                      GPA: {es.gpa != null ? es.gpa.toFixed(2) : '—'} &middot; {es.passed}/{es.totalExams} passed
                    </span>
                  </h4>
                  {es.results.length === 0 ? (
                    <p className="muted" style={{ fontSize: '0.85rem' }}>No results for this enrollment.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                      {es.results.map((r) => (
                        <div key={r.examId} className="card" style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{r.exam?.title ?? '—'}</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{r.obtainedMarks}/{r.exam?.totalMarks ?? '?'}</div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <span className={`status-pill status-${r.status === 'pass' ? 'success' : r.status === 'fail' ? 'danger' : 'warning'}`}>
                              {r.grade ?? r.status}
                            </span>
                            <span className="dt-mono" style={{ fontSize: '0.8rem', opacity: 0.6 }}>{Number(r.percentage).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {academicTab === 'attendance' && (
          <div>
            {attendanceSummaries.length === 0 ? (
              <p className="muted">No attendance records found.</p>
            ) : (
              <TableWrapper className="table-wrapper--sticky">
                <table className="data-table erp-table-compact institute-table-premium">
                  <thead>
                    <tr>
                      <th>Enrollment</th>
                      <th className="num">Total Classes</th>
                      <th className="num">Present</th>
                      <th className="num">Absent</th>
                      <th className="num">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceSummaries.map((a) => {
                      const enrollment = enrollments.find((e) => e.id === a.enrollmentId);
                      const pct = a.percentage ?? 0;
                      return (
                        <tr key={a.enrollmentId}>
                          <td>{enrollment?.batch?.course?.title ?? '—'} / {enrollment?.batch?.name ?? '—'}</td>
                          <td className="num dt-mono">{a.totalClasses}</td>
                          <td className="num dt-mono" style={{ color: 'var(--success)' }}>{a.present}</td>
                          <td className="num dt-mono" style={{ color: 'var(--danger)' }}>{a.absent}</td>
                          <td className="num">
                            <span className={`status-pill status-${pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger'}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrapper>
            )}
          </div>
        )}
      </section>

      <EnrollStudentModal
        open={enrollOpen}
        defaultStudentId={studentId}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={() => load({ silent: true })}
      />

      <EditStudentModal
        open={editOpen}
        student={student}
        onClose={() => setEditOpen(false)}
        onSaved={(s) => setStudent(s)}
      />

      <RecordPaymentModal open={Boolean(payFee)} fee={payFee} onClose={() => setPayFee(null)} onRecorded={afterPayment} />
    </PageLayout>
  );
}
