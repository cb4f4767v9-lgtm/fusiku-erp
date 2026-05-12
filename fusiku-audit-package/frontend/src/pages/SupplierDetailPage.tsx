import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { suppliersApi } from '../services/api';
import { Pencil, ArrowLeft } from 'lucide-react';
import { PageLayout, LoadingSkeleton } from '../components/design-system';

function formatContactTypeLabel(input: string) {
  const v = String(input || '').trim().toLowerCase();
  if (v === 'mobile') return 'Mobile';
  if (v === 'landline') return 'Landline';
  if (v === 'phone') return 'Mobile';
  if (v === 'whatsapp') return 'WhatsApp';
  if (v === 'wechat') return 'WeChat';
  if (v === 'facebook') return 'Facebook';
  if (v === 'we chat') return 'WeChat';
  if (v === 'whats app') return 'WhatsApp';
  return input || '';
}

export function SupplierDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [supplier, setSupplier] = useState<any>(null);

  useEffect(() => {
    if (id) {
      suppliersApi.getById(id).then((r) => setSupplier(r.data)).catch(() => navigate('/suppliers'));
    }
  }, [id, navigate]);

  if (!supplier) {
    return (
      <PageLayout className="page">
        <LoadingSkeleton variant="dashboard" />
      </PageLayout>
    );
  }

  const advancePaid = Number(supplier.availableBalance ?? 0);
  const blockedAmount = Number(supplier.blockedBalance ?? 0);
  const creditBalance = String(supplier.balanceType || 'debit') === 'credit' ? Number(supplier.openingBalance ?? 0) : 0;
  const statusLabel = supplier.moneyStatus === 'blocked' ? t('common.blocked') : t('common.active');

  return (
    <PageLayout className="page erp-form-page erp-form-compact">
      <div className="erp-form-header">
        <button type="button" className="btn btn-secondary btn-erp" onClick={() => navigate('/suppliers')}>
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <button type="button" className="btn btn-primary btn-erp" onClick={() => navigate(`/suppliers/${id}/edit`)}>
          <Pencil size={16} /> {t('common.edit')}
        </button>
      </div>

      <div className="erp-form-sections">
        <section className="erp-section erp-section-compact">
          <h3>{t('erp.basicInformation')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('suppliers.name')}</label>
              <span>{supplier.name}</span>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.contactTypeEmail')}</label>
              <span>{supplier.email || '—'}</span>
            </div>
            <div className="erp-field-row">
              <label>{t('common.phone')}</label>
              <span>{supplier.phone || '—'}</span>
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact">
          <h3>{t('erp.financial')}</h3>
          <div className="supplier-balance-card">
            <div className="supplier-balance-row">
              <span>{t('erp.advance_paid')}</span>
              <span>{new Intl.NumberFormat((t as any).i18n?.language).format(advancePaid)}</span>
            </div>
            <div className="supplier-balance-row">
              <span>{t('erp.credit_balance')}</span>
              <span>{new Intl.NumberFormat((t as any).i18n?.language).format(creditBalance)}</span>
            </div>
            <div className="supplier-balance-row">
              <span>{t('erp.blocked_amount')}</span>
              <span>{new Intl.NumberFormat((t as any).i18n?.language).format(blockedAmount)}</span>
            </div>
            <div className="supplier-balance-row remaining">
              <span>{t('common.status')}</span>
              <span>{statusLabel}</span>
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact">
          <h3>{t('suppliers.address')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('suppliers.country')}</label>
              <span>{supplier.country || '—'}</span>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.province')}</label>
              <span>{supplier.province || '—'}</span>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.city')}</label>
              <span>{supplier.city || '—'}</span>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.street')}</label>
              <span>{supplier.address || '—'}</span>
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact">
          <h3>{t('suppliers.contacts')}</h3>
          <table className="erp-table erp-table-compact">
            <thead>
              <tr>
                <th>{t('erp.type')}</th>
                <th>{t('suppliers.value')}</th>
              </tr>
            </thead>
            <tbody>
              {(supplier.contacts || []).map((c: any) => (
                <tr key={c.id}>
                  <td>{formatContactTypeLabel(c.contactType)}</td>
                  <td>{c.value}</td>
                </tr>
              ))}
              {(supplier.contacts || []).length === 0 && <tr><td colSpan={2} className="erp-empty">—</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </PageLayout>
  );
}
