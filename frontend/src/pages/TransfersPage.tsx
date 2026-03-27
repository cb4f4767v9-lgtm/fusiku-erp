import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transfersApi, branchesApi, inventoryApi, downloadPdf } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

export function TransfersPage() {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fromBranchId: '', toBranchId: '', transferMarginPercent: 0, inventoryIds: [] as string[] });

  const load = () => {
    transfersApi.getAll().then((r) => setTransfers(r.data)).catch(() => setTransfers([]));
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (form.fromBranchId) {
      inventoryApi.getAll({ branchId: form.fromBranchId, status: 'available' })
        .then((r) => setInventory(r.data))
        .catch(() => setInventory([]));
    } else {
      setInventory([]);
    }
  }, [form.fromBranchId]);

  const toggleItem = (id: string) => {
    setForm((f) => ({
      ...f,
      inventoryIds: f.inventoryIds.includes(id)
        ? f.inventoryIds.filter((x) => x !== id)
        : [...f.inventoryIds, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fromBranchId || !form.toBranchId || form.inventoryIds.length === 0) {
      toast.error(t('transfers.selectBranchesAndItems'));
      return;
    }
    if (form.fromBranchId === form.toBranchId) {
      toast.error(t('transfers.cannotTransferSameBranch'));
      return;
    }
    try {
      await transfersApi.create({
        fromBranchId: form.fromBranchId,
        toBranchId: form.toBranchId,
        transferMarginPercent: Number(form.transferMarginPercent) || 0,
        inventoryIds: form.inventoryIds
      });
      toast.success(t('transfers.transferCompleted'));
      setShowForm(false);
      setForm({ fromBranchId: '', toBranchId: '', transferMarginPercent: 0, inventoryIds: [] });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('transfers.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} /> {t('transfers.newTransfer')}
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('transfers.date')}</th>
              <th>{t('transfers.from')}</th>
              <th>{t('transfers.to')}</th>
              <th>{t('transfers.items')}</th>
              <th>{t('transfers.status')}</th>
              <th>{t('transfers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((tr) => (
              <tr key={tr.id}>
                <td>{new Date(tr.createdAt).toLocaleDateString()}</td>
                <td>{tr.fromBranch?.name}</td>
                <td>{tr.toBranch?.name}</td>
                <td>{tr.transferItems?.length || 0}</td>
                <td><span className={`badge badge-${tr.status}`}>{tr.status}</span></td>
                <td>
                  {tr.status === 'pending' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={async () => {
                        try {
                          await transfersApi.approve(tr.id);
                          toast.success(t('transfers.transferApproved'));
                          load();
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || 'Approve failed');
                        }
                      }}
                    >
                      {t('transfers.approve')}
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-secondary ml-1"
                    onClick={() => downloadPdf('transfer', tr.id).catch(() => toast.error(t('common.pdfDownloadFailed')))}
                  >
                    PDF
                  </button>
                </td>
              </tr>
            ))}
            {transfers.length === 0 && <tr><td colSpan={6}>{t('transfers.noTransfers')}</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('transfers.newTransferModal')}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <select
                required
                value={form.fromBranchId}
                onChange={(e) => setForm((f) => ({ ...f, fromBranchId: e.target.value, inventoryIds: [] }))}
              >
                <option value="">{t('transfers.fromBranch')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select
                required
                value={form.toBranchId}
                onChange={(e) => setForm((f) => ({ ...f, toBranchId: e.target.value }))}
              >
                <option value="">{t('transfers.toBranch')}</option>
                {branches.filter((b) => b.id !== form.fromBranchId).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <div className="form-field">
                <label>{t('transfers.transferMarginPercent', 'Transfer Margin %')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.transferMarginPercent || ''}
                  onChange={(e) => setForm((f) => ({ ...f, transferMarginPercent: Number(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
              <div className="transfer-items">
                <label>{t('transfers.selectItemsToTransfer')}</label>
                {inventory.map((item) => (
                  <label key={item.id} className="transfer-item-check">
                    <input
                      type="checkbox"
                      checked={form.inventoryIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                    {item.imei} - {item.brand} {item.model} (${Number(item.sellingPrice).toFixed(2)})
                  </label>
                ))}
                {inventory.length === 0 && form.fromBranchId && <p>{t('transfers.noAvailableItems')}</p>}
              </div>
              <button type="submit" className="btn btn-primary" disabled={form.inventoryIds.length === 0}>
                {t('transfers.createTransfer')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
