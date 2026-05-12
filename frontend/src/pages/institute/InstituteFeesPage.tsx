import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import i18n from '../../i18n';
import { instituteApi, type InstituteFeeCharge } from '../../services/api';
import { PageLayout, PageHeader, TableWrapper, EmptyState, ErrorState, TableSkeleton } from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';
import { instituteParseAxiosError, type InstituteLoadError } from '../../utils/instituteLoadUi';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { instituteDec } from '../../utils/instituteMoney';
import { RecordPaymentModal } from '../../components/institute/RecordPaymentModal';

export function InstituteFeesPage() {
  const { t } = useTranslation();
  usePageTitle('institute.feesTitle');

  const [fees, setFees] = useState<InstituteFeeCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<InstituteLoadError | null>(null);
  const [payFee, setPayFee] = useState<InstituteFeeCharge | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    void instituteApi
      .listFees()
      .then((r: { data?: InstituteFeeCharge[] }) => setFees(r.data || []))
      .catch((e: unknown) => {
        setLoadError(instituteParseAxiosError(e, i18n.t('common.unableToLoadData')));
        setFees([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const afterPayment = () => {
    toast.success(t('institute.feesRefreshed'));
    load();
  };

  if (loading) {
    return (
      <PageLayout className="page erp-list-page">
        <PageHeader title={t('institute.feesTitle')} subtitle={t('institute.feesSubtitle')} />
        <TableWrapper>
          <TableSkeleton rows={10} cols={8} />
        </TableWrapper>
      </PageLayout>
    );
  }

  if (loadError) {
    return (
      <PageLayout className="page erp-list-page">
        <PageHeader title={t('institute.feesTitle')} subtitle={t('institute.feesSubtitle')} />
        <ErrorState
          message={loadError.title}
          hint={loadError.hint}
          technicalDetails={loadError.technicalDetails}
          onRetry={load}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="page erp-list-page">
      <PageHeader title={t('institute.feesTitle')} subtitle={t('institute.feesSubtitle')} />

      {fees.length === 0 ? (
        <EmptyState title={t('institute.feesEmpty')} description={t('institute.feesEmptyHint')} />
      ) : (
        <TableWrapper>
          <table className="data-table erp-table-compact institute-table">
            <thead>
              <tr>
                <th>{t('institute.colStudent')}</th>
                <th>{t('institute.feeLabel')}</th>
                <th className="num">{t('institute.colAmount')}</th>
                <th className="num">{t('institute.colPaid')}</th>
                <th className="num">{t('institute.colBalance')}</th>
                <th>{t('institute.colStatus')}</th>
                <th>{t('institute.colDue')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => {
                const name = f.student?.fullName || '—';
                const cur = (f.currency || '').trim().toUpperCase();
                const canPay = instituteDec(f.balance) > 0.0001;
                return (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/institute/students/${f.studentId}`} className="institute-link">
                        {name}
                      </Link>
                    </td>
                    <td>{f.label || t('institute.feeDefaultLabel')}</td>
                    <td className="num">{formatCurrency(instituteDec(f.amount), cur)}</td>
                    <td className="num">{formatCurrency(instituteDec(f.paidAmount), cur)}</td>
                    <td className="num">{formatCurrency(instituteDec(f.balance), cur)}</td>
                    <td>
                      <span className={`institute-pill institute-pill--${String(f.status).toLowerCase()}`}>
                        {f.status}
                      </span>
                    </td>
                    <td>{f.dueDate ? formatDate(f.dueDate) : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={!canPay}
                        onClick={() => canPay && setPayFee(f)}
                      >
                        {t('institute.recordPaymentShort')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrapper>
      )}

      <RecordPaymentModal open={Boolean(payFee)} fee={payFee} onClose={() => setPayFee(null)} onRecorded={afterPayment} />
    </PageLayout>
  );
}
