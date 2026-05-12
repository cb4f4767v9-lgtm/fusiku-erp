import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { purchasesApi, suppliersApi, customersApi, branchesApi, importApi, downloadPdf } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Download, FileText, Printer } from 'lucide-react';
import { useSearch } from '../contexts/SearchContext';
import { useSaasCommercialGate } from '../hooks/useSaasCommercialGate';
import { getErrorMessage } from '../utils/getErrorMessage';
import { EmptyState, LoadingSkeleton, PageLayout, PageHeader, TableWrapper } from '../components/design-system';
import { useAuth } from '../hooks/useAuth';
import { isSuperAdmin } from '../utils/permissions';
import { formatDateForUi, formatNumberForUi } from '../utils/formatting';

export function PurchasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { commercialWritesAllowed } = useSaasCommercialGate();
  const { user } = useAuth();
  const { searchQuery } = useSearch();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ supplierId: '', branchId: '' });

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      purchasesApi.getAll({}).then((r) => setPurchases(r.data)).catch(() => setPurchases([])),
      suppliersApi.getAll().then((r) => setSuppliers(r.data)).catch(() => setSuppliers([])),
      customersApi.getAll().then((r) => setCustomers(r.data)).catch(() => setCustomers([])),
      branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isSuperAdmin(user) && user?.branchId) {
      setForm((f) => ({ ...f, branchId: user.branchId! }));
    }
  }, [user?.branchId]);

  const q = searchQuery.trim().toLowerCase();
  const filteredPurchases = purchases.filter((p) => {
    if (!q) return true;
    const supplierName = (p.supplier?.name || '').toLowerCase();
    const customerName = (p.customer?.name || '').toLowerCase();
    const invoiceNum = (p.invoiceNumber || p.id || '').toLowerCase();
    const dateStr = new Date(p.createdAt).toISOString().slice(0, 10);
    const dateDisplay = formatDateForUi(p.createdAt).toLowerCase();
    const imeiMatch = (p.purchaseItems || []).some((i: any) => (i.imei || '').toLowerCase().includes(q));
    return (
      supplierName.includes(q) ||
      customerName.includes(q) ||
      invoiceNum.includes(q) ||
      dateStr.includes(q) ||
      dateDisplay.includes(q) ||
      imeiMatch
    );
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!commercialWritesAllowed) {
      toast.error(t('saas.actionBlocked'));
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    const effectiveBranchId = isSuperAdmin(user) ? form.branchId : (user?.branchId || form.branchId);
    if (!file || !effectiveBranchId || !form.supplierId) {
      toast.error(t('purchases.selectFileBranchSupplier'));
      return;
    }
    try {
      const { data } = await importApi.purchases(file, effectiveBranchId, form.supplierId);
      toast.success(t('purchases.importedItems', { count: data.success }));
      setShowImport(false);
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('inventory.importFailed')));
    }
    e.target.value = '';
  };

  return (
    <PageLayout className="page page-compact page-container">
      <PageHeader
        title={t('purchases.title')}
        subtitle={t('purchases.purchaseList')}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary ds-has-tooltip"
              data-tooltip={t('common.export', { defaultValue: 'Export (coming soon)' })}
              onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }))}
            >
              <Download size={16} /> {t('common.export', { defaultValue: 'Export' })}
            </button>
            <button
              type="button"
              className="btn btn-secondary ds-has-tooltip"
              data-tooltip={t('common.print', { defaultValue: 'Print (coming soon)' })}
              onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }))}
            >
              <Printer size={16} /> {t('common.print', { defaultValue: 'Print' })}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!commercialWritesAllowed}
              onClick={() => setShowImport(true)}
            >
              <Upload size={16} /> {t('common.import')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!commercialWritesAllowed}
              onClick={() => navigate('/purchases/new')}
            >
              <Plus size={16} /> {t('purchases.newPurchase')}
            </button>
          </>
        }
      />
      {loading ? (
        <LoadingSkeleton variant="table" rows={7} cols={7} />
      ) : filteredPurchases.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={t('purchases.noPurchases', { defaultValue: 'No purchases yet' })}
          description={t('purchases.noPurchasesHint', {
            defaultValue: 'Create your first purchase to start tracking inventory cost and supplier performance.',
          })}
          action={
            <button
              type="button"
              className="btn btn-primary"
              disabled={!commercialWritesAllowed}
              onClick={() => navigate('/purchases/new')}
            >
              <Plus size={16} /> {t('purchases.newPurchase')}
            </button>
          }
        />
      ) : (
        <TableWrapper>
          <table className="data-table table-grid">
            <thead>
              <tr>
                <th>{t('purchases.invoiceNumber')}</th>
                <th>{t('purchases.date')}</th>
                <th>{t('purchases.supplier')}</th>
                <th>{t('purchases.branch')}</th>
                <th>{t('purchases.amount')}</th>
                <th>{t('purchases.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.invoiceNumber || p.id?.slice(-8)}</td>
                  <td>{formatDateForUi(p.createdAt)}</td>
                  <td>{p.supplier?.name || p.customer?.name}</td>
                  <td>{p.branch?.name}</td>
                  <td>${formatNumberForUi(Number(p.totalAmount), { maximumFractionDigits: 2 })}</td>
                  <td><span className="badge">{p.status}</span></td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => downloadPdf('purchase', p.id).catch(() => toast.error(t('common.pdfFailed')))}>
                      <Download size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      )}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('purchases.importPurchases')}</h2>
            <select value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
              <option value="">{t('purchases.supplier')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={isSuperAdmin(user) ? form.branchId : (user?.branchId || form.branchId)}
              disabled={!isSuperAdmin(user)}
              onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
            >
              <option value="">{t('purchases.branch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={18} /> {t('purchases.chooseFile')}
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} hidden />
            </label>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
