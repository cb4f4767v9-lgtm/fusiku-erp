import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { repairsApi, usersApi, customersApi, downloadPdf, imeiApi, aiApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Download, Sparkles } from 'lucide-react';

export function RepairsPage() {
  const { t } = useTranslation();
  const [repairs, setRepairs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ imei: '', faultDescription: '', technicianId: '', customerId: '', repairCost: '', notes: '' });
  const [deviceModel, setDeviceModel] = useState<string>('');
  const [repairSuggestions, setRepairSuggestions] = useState<any>(null);

  const load = () => {
    repairsApi.getAll().then((r) => setRepairs(r.data)).catch(() => setRepairs([]));
    usersApi.getAll().then((r) => setUsers(r.data)).catch(() => setUsers([]));
    customersApi.getAll().then((r) => setCustomers(r.data)).catch(() => setCustomers([]));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (form.imei.length >= 15) {
      imeiApi.lookup(form.imei).then((r) => {
        const d = r.data;
        if (d?.model) setDeviceModel(`${d.brand || ''} ${d.model || ''}`.trim() || d.model);
        else setDeviceModel('');
      }).catch(() => setDeviceModel(''));
    } else setDeviceModel('');
  }, [form.imei]);

  useEffect(() => {
    if (deviceModel && form.faultDescription.trim().length >= 3) {
      const model = deviceModel.split(' ').pop() || deviceModel;
      aiApi.repairSuggestions({ model, fault: form.faultDescription }).then((r) => setRepairSuggestions(r.data)).catch(() => setRepairSuggestions(null));
    } else setRepairSuggestions(null);
  }, [deviceModel, form.faultDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imei || !form.faultDescription || !form.technicianId || !form.repairCost) {
      toast.error(t('repairs.fillRequiredFields'));
      return;
    }
    try {
      await repairsApi.create({
        ...form,
        repairCost: Number(form.repairCost)
      });
      toast.success(t('repairs.repairAdded'));
      setShowForm(false);
      setForm({ imei: '', faultDescription: '', technicianId: '', customerId: '', repairCost: '', notes: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await repairsApi.update(id, { status });
      toast.success(t('repairs.updated'));
      load();
    } catch (err: any) {
      toast.error(t('repairs.updateFailed'));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('repairs.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={18} /> {t('repairs.addRepair')}</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('repairs.imei')}</th>
              <th>{t('repairs.fault')}</th>
              <th>{t('repairs.technician')}</th>
              <th>{t('repairs.cost')}</th>
              <th>{t('repairs.status')}</th>
              <th>{t('repairs.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {repairs.map((r) => (
              <tr key={r.id}>
                <td>{r.imei}</td>
                <td>{r.faultDescription}</td>
                <td>{r.technician?.name}</td>
                <td>${Number(r.repairCost).toFixed(2)}</td>
                <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                <td>
                  {r.status === 'pending' && <button className="btn-sm" onClick={() => updateStatus(r.id, 'in_progress')}>{t('repairs.start')}</button>}
                  {r.status === 'in_progress' && <button className="btn-sm" onClick={() => updateStatus(r.id, 'completed')}>{t('repairs.complete')}</button>}
                  <button className="btn btn-sm btn-secondary ml-1" onClick={() => downloadPdf('repair', r.id).catch(() => toast.error(t('common.pdfFailed')))}>
                    <Download size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {repairs.length === 0 && <tr><td colSpan={6}>{t('repairs.noRepairs')}</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('repairs.addRepair')}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <input required placeholder={t('repairs.imei')} value={form.imei} onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))} />
              <textarea required placeholder={t('repairs.faultDescription')} value={form.faultDescription} onChange={(e) => setForm((f) => ({ ...f, faultDescription: e.target.value }))} />
              {repairSuggestions && (
                <div className="repair-suggestions">
                  <h4><Sparkles size={16} /> {t('repairs.aiRepairAssistant')}</h4>
                  {repairSuggestions.possibleCauses?.length > 0 && (
                    <div>
                      <strong>{t('repairs.possibleCauses')}</strong>
                      <ul>{repairSuggestions.possibleCauses.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                  {repairSuggestions.recommendedSteps?.length > 0 && (
                    <div>
                      <strong>{t('repairs.recommendedSteps')}</strong>
                      <ol>{repairSuggestions.recommendedSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
                    </div>
                  )}
                  {repairSuggestions.estimatedCostRange && (
                    <p><strong>{t('repairs.estimatedCost')}</strong> {repairSuggestions.estimatedCostRange}</p>
                  )}
                </div>
              )}
              <select required value={form.technicianId} onChange={(e) => setForm((f) => ({ ...f, technicianId: e.target.value }))}>
                <option value="">{t('repairs.selectTechnician')}</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
                <option value="">{t('repairs.selectCustomerOptional')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" required placeholder={t('repairs.repairCost')} value={form.repairCost} onChange={(e) => setForm((f) => ({ ...f, repairCost: e.target.value }))} />
              <textarea placeholder={t('common.notes')} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <button type="submit" className="btn btn-primary">{t('common.add')}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
