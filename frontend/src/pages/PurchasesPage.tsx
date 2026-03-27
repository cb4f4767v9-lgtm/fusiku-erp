import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { purchasesApi, suppliersApi, customersApi, branchesApi, importApi, downloadPdf } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Download } from 'lucide-react';
import { useSearch } from '../contexts/SearchContext';

export function PurchasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { searchQuery } = useSearch();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ supplierId: '', branchId: '' });

  const load = () => {
    purchasesApi.getAll({}).then((r) => setPurchases(r.data)).catch(() => setPurchases([]));
    suppliersApi.getAll().then((r) => setSuppliers(r.data)).catch(() => setSuppliers([]));
    customersApi.getAll().then((r) => setCustomers(r.data)).catch(() => setCustomers([]));
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
  };

  useEffect(() => { load(); }, []);

  const q = searchQuery.trim().toLowerCase();
  const filteredPurchases = purchases.filter((p) => {
    if (!q) return true;
    const supplierName = (p.supplier?.name || '').toLowerCase();
    const customerName = (p.customer?.name || '').toLowerCase();
    const invoiceNum = (p.invoiceNumber || p.id || '').toLowerCase();
    const dateStr = new Date(p.createdAt).toISOString().slice(0, 10);
    const dateDisplay = new Date(p.createdAt).toLocaleDateString().toLowerCase();
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
    const file = e.target.files?.[0];
    if (!file || !form.branchId || !form.supplierId) {
      toast.error(t('purchases.selectFileBranchSupplier'));
      return;
    }
    try {
      const { data } = await importApi.purchases(file, form.branchId, form.supplierId);
      toast.success(t('purchases.importedItems', { count: data.success }));
      setShowImport(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('inventory.importFailed'));
    }
    e.target.value = '';
  };

  return (
    <div className="page page-compact page-container">
      <div className="purchase-list-header">
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}><Upload size={16} /> {t('common.import')}</button>
          <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}><Plus size={16} /> {t('purchases.newPurchase')}</button>
        </div>
      </div>
      <div className="table-container">
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
                <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                <td>{p.supplier?.name || p.customer?.name}</td>
                <td>{p.branch?.name}</td>
                <td>${Number(p.totalAmount).toLocaleString()}</td>
                <td><span className="badge">{p.status}</span></td>
                <td>
                  <button className="btn btn-secondary" onClick={() => downloadPdf('purchase', p.id).catch(() => toast.error(t('common.pdfFailed')))}>
                    <Download size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredPurchases.length === 0 && <tr><td colSpan={7}>{t('purchases.noPurchases')}</td></tr>}
          </tbody>
        </table>
      </div>
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('purchases.importPurchases')}</h2>
            <select value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
              <option value="">{t('purchases.supplier')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
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
    </div>
  );
}
