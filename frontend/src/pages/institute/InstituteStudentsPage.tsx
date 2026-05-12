import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, UserPlus } from 'lucide-react';
import {
  instituteApi,
  type InstituteEnrollment,
  type InstituteFeeCharge,
  type InstituteStudent,
} from '../../services/api';
import {
  PageLayout,
  PageHeader,
  TableWrapper,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useAuth } from '../../hooks/useAuth';
import { instituteParseAxiosError, type InstituteLoadError } from '../../utils/instituteLoadUi';
import { instituteDec } from '../../utils/instituteMoney';
import { AddStudentModal } from '../../components/institute/AddStudentModal';
import { EnrollStudentModal } from '../../components/institute/EnrollStudentModal';
import { InstituteStudentTableRow } from '../../components/institute/InstituteStudentTableRow';
import i18n from '../../i18n';

type Agg = { total: number; paid: number; balance: number };

const PAGE_SIZE = 12;

function aggregateByStudent(fees: InstituteFeeCharge[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const f of fees) {
    const cur = m.get(f.studentId) ?? { total: 0, paid: 0, balance: 0 };
    cur.total += instituteDec(f.amount);
    cur.paid += instituteDec(f.paidAmount);
    cur.balance += instituteDec(f.balance);
    m.set(f.studentId, cur);
  }
  return m;
}

function currencyForStudentRow(
  studentId: string,
  fees: InstituteFeeCharge[],
  fallbackIso: string
): string {
  const f = fees.find((x) => x.studentId === studentId);
  return (f?.currency || fallbackIso).toUpperCase();
}

export function InstituteStudentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultCurrency = String(user?.branchDefaultCurrency || user?.currency || '')
    .trim()
    .toUpperCase();

  usePageTitle('institute.studentsTitle');

  const [students, setStudents] = useState<InstituteStudent[]>([]);
  const [fees, setFees] = useState<InstituteFeeCharge[]>([]);
  const [enrollments, setEnrollments] = useState<InstituteEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<InstituteLoadError | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const load = useCallback((opts?: { silent?: boolean }) => {
    setLoadError(null);
    if (!opts?.silent) setLoading(true);
    void Promise.all([
      instituteApi.listStudents(),
      instituteApi.listFees(),
      instituteApi.listEnrollments(),
    ])
      .then(([sr, fr, er]) => {
        setStudents(sr.data || []);
        setFees(fr.data || []);
        setEnrollments(er.data || []);
      })
      .catch((e: unknown) => {
        setLoadError(instituteParseAxiosError(e, i18n.t('common.unableToLoadData')));
        setStudents([]);
        setFees([]);
        setEnrollments([]);
      })
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agg = useMemo(() => aggregateByStudent(fees), [fees]);

  const filtered = useMemo(() => {
    let rows = students;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (s) =>
          (s.fullName || '').toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q) ||
          (s.studentCode || '').toLowerCase().includes(q) ||
          (s.status || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          (s.whatsApp || '').toLowerCase().includes(q) ||
          (s.identityDocumentNumber || '').toLowerCase().includes(q) ||
          (s.guardianName || '').toLowerCase().includes(q) ||
          (s.guardianPhone || '').toLowerCase().includes(q) ||
          (s.nationalId || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((s) => String(s.status || '').toLowerCase() === statusFilter.toLowerCase());
    }
    return rows;
  }, [students, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (pageClamped - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageClamped]);

  const onRowKey = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/institute/students/${id}`);
    }
  }, [navigate]);

  const goStudent = useCallback((id: string) => {
    navigate(`/institute/students/${id}`);
  }, [navigate]);

  if (loading && students.length === 0 && !loadError) {
    return (
      <PageLayout className="page erp-list-page">
        <PageHeader title={t('institute.studentsTitle')} subtitle={t('institute.studentsSubtitle')} />
        <TableWrapper className="table-wrapper--sticky institute-table-shell">
          <TableSkeleton rows={10} cols={14} />
        </TableWrapper>
      </PageLayout>
    );
  }

  if (loadError) {
    return (
      <PageLayout className="page erp-list-page">
        <PageHeader title={t('institute.studentsTitle')} subtitle={t('institute.studentsSubtitle')} />
        <ErrorState
          message={loadError.title}
          hint={loadError.hint}
          technicalDetails={loadError.technicalDetails}
          onRetry={() => load()}
        />
      </PageLayout>
    );
  }

  const noStudents = students.length === 0;

  return (
    <PageLayout className="page erp-list-page institute-students-page">
      <PageHeader
        title={t('institute.studentsTitle')}
        subtitle={t('institute.studentsSubtitle')}
        actions={
          <>
            <select
              className="input institute-toolbar-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t('institute.filterByStatus')}
            >
              <option value="all">{t('institute.statusAll')}</option>
              <option value="active">{t('institute.statusActive')}</option>
              <option value="completed">{t('institute.statusCompleted')}</option>
              <option value="discontinued">{t('institute.statusDiscontinued')}</option>
              <option value="suspended">{t('institute.statusSuspended')}</option>
              <option value="leave">{t('institute.statusLeave')}</option>
              <option value="graduated">{t('institute.statusGraduated')}</option>
              <option value="inactive">{t('institute.statusInactive')}</option>
            </select>
            <input
              type="search"
              className="erp-search"
              placeholder={t('institute.studentsSearch')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('common.search')}
            />
            <button type="button" className="btn btn-secondary btn-erp" onClick={() => setAddOpen(true)}>
              <Plus size={16} aria-hidden />
              {t('institute.addStudentButton')}
            </button>
            <button type="button" className="btn btn-primary btn-erp" onClick={() => setEnrollOpen(true)}>
              <UserPlus size={16} aria-hidden />
              {t('institute.enrollButton')}
            </button>
          </>
        }
      />

      {filtered.length === 0 ? (
        noStudents ? (
          <EmptyState
            title={t('institute.studentsEmpty')}
            description={t('institute.studentsEmptyHint')}
            action={
              <div className="institute-empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
                  <Plus size={16} aria-hidden />
                  {t('institute.addStudentButton')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEnrollOpen(true)}>
                  <UserPlus size={16} aria-hidden />
                  {t('institute.enrollButton')}
                </button>
              </div>
            }
          />
        ) : (
          <EmptyState
            title={t('institute.studentsNoMatches')}
            description={t('institute.studentsNoMatchesHint', { query: search.trim() })}
            action={
              <button type="button" className="btn btn-secondary" onClick={() => setSearch('')}>
                {t('institute.clearSearch')}
              </button>
            }
          />
        )
      ) : (
        <>
          <TableWrapper
            className={`table-wrapper--sticky institute-table-scroll institute-table-shell${loading ? ' table-wrapper--loading' : ''}`}
          >
            <table className="data-table erp-table-compact institute-table institute-table-premium institute-table-students institute-table-students--wide">
              <thead>
                <tr>
                  <th className="institute-col-photo">{t('institute.colPhoto')}</th>
                  <th>{t('institute.fieldStudentId')}</th>
                  <th>{t('institute.colName')}</th>
                  <th>{t('institute.colStudentPhone')}</th>
                  <th>{t('institute.colGuardianPhone')}</th>
                  <th>{t('institute.colCourse')}</th>
                  <th>{t('institute.colBatch')}</th>
                  <th className="institute-col-timing">{t('institute.colTiming')}</th>
                  <th>{t('institute.colStatus')}</th>
                  <th className="num">{t('institute.colTotalFees')}</th>
                  <th className="num">{t('institute.colBalance')}</th>
                  <th className="num institute-col-attendance">{t('institute.colAttendancePct')}</th>
                  <th className="institute-col-result">{t('institute.colResult')}</th>
                  <th className="institute-col-actions">{t('institute.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((s) => {
                  const a = agg.get(s.id) ?? { total: 0, paid: 0, balance: 0 };
                  const cur = currencyForStudentRow(s.id, fees, defaultCurrency);
                  return (
                    <InstituteStudentTableRow
                      key={s.id}
                      student={s}
                      agg={a}
                      currency={cur}
                      enrollments={enrollments}
                      onNavigate={goStudent}
                      onRowKey={onRowKey}
                      t={t}
                    />
                  );
                })}
              </tbody>
            </table>
          </TableWrapper>

          {filtered.length > PAGE_SIZE ? (
            <div className="institute-pagination" role="navigation" aria-label={t('common.pagination')}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pageClamped <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} aria-hidden /> {t('common.back')}
              </button>
              <span className="institute-pagination__meta">
                {t('institute.pageOf', { page: pageClamped, totalPages, count: filtered.length })}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pageClamped >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('common.next')} <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      )}

      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          load({ silent: true });
        }}
      />

      <EnrollStudentModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={() => {
          load({ silent: true });
        }}
      />
    </PageLayout>
  );
}
