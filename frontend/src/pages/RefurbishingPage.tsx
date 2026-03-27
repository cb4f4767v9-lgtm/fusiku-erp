import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { refurbishApi, usersApi, aiApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Sparkles } from 'lucide-react';

export function RefurbishingPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ incomingDevice: '', partsUsed: '', laborCost: '', finalCondition: 'A', technicianId: '', notes: '' });
  const [suggestedGrade, setSuggestedGrade] = useState<string | null>(null);

  const load = () => {
    refurbishApi.getAll().then((r) => setJobs(r.data)).catch(() => setJobs([]));
    usersApi.getAll().then((r) => setUsers(r.data)).catch(() => setUsers([]));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const notes = `${form.notes} ${form.partsUsed}`.trim();
    if (notes.length >= 5) {
      aiApi.conditionSuggest(notes).then((r) => setSuggestedGrade(r.data?.grade || null)).catch(() => setSuggestedGrade(null));
    } else setSuggestedGrade(null);
  }, [form.notes, form.partsUsed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.incomingDevice || !form.technicianId || !form.laborCost || !form.finalCondition) {
      toast.error(t('refurbishing.fillRequiredFields'));
      return;
    }
    try {
      await refurbishApi.create({
        ...form,
        laborCost: Number(form.laborCost)
      });
      toast.success(t('refurbishing.jobAdded'));
      setShowForm(false);
      setForm({ incomingDevice: '', partsUsed: '', laborCost: '', finalCondition: 'A', technicianId: '', notes: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await refurbishApi.update(id, { status });
      toast.success(t('refurbishing.updated'));
      load();
    } catch {
      toast.error(t('refurbishing.updateFailed'));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('refurbishing.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={18} /> {t('refurbishing.addJob')}</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('refurbishing.device')}</th>
              <th>{t('refurbishing.partsUsed')}</th>
              <th>{t('refurbishing.laborCost')}</th>
              <th>{t('refurbishing.finalCondition')}</th>
              <th>{t('refurbishing.technician')}</th>
              <th>{t('refurbishing.status')}</th>
              <th>{t('refurbishing.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.incomingDevice}</td>
                <td>{j.partsUsed || '—'}</td>
                <td>${Number(j.laborCost).toFixed(2)}</td>
                <td>{j.finalCondition}</td>
                <td>{j.technician?.name}</td>
                <td><span className={`badge badge-${j.status}`}>{j.status}</span></td>
                <td>
                  {j.status === 'pending' && <button className="btn-sm" onClick={() => updateStatus(j.id, 'in_progress')}>{t('refurbishing.start')}</button>}
                  {j.status === 'in_progress' && <button className="btn-sm" onClick={() => updateStatus(j.id, 'completed')}>{t('refurbishing.complete')}</button>}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={7}>{t('refurbishing.noJobs')}</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('refurbishing.addRefurbishJob')}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <input required placeholder={t('refurbishing.incomingDevice')} value={form.incomingDevice} onChange={(e) => setForm((f) => ({ ...f, incomingDevice: e.target.value }))} />
              <textarea placeholder={t('refurbishing.partsUsed')} value={form.partsUsed} onChange={(e) => setForm((f) => ({ ...f, partsUsed: e.target.value }))} />
              <input type="number" required placeholder={t('refurbishing.laborCost')} value={form.laborCost} onChange={(e) => setForm((f) => ({ ...f, laborCost: e.target.value }))} />
              <div>
                <label>{t('refurbishing.finalConditionGrade')}</label>
                {suggestedGrade && (
                  <div className="condition-suggest" style={{ fontSize: 12, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} /> {t('refurbishing.aiSuggests')} <strong>{suggestedGrade}</strong> {t('refurbishing.selectBelowToOverride')}
                  </div>
                )}
                <select value={form.finalCondition} onChange={(e) => setForm((f) => ({ ...f, finalCondition: e.target.value }))}>
                  <option value="A+">{t('refurbishing.gradeAplus')}</option>
                  <option value="A">{t('refurbishing.gradeA')}</option>
                  <option value="B">{t('refurbishing.gradeB')}</option>
                  <option value="C">{t('refurbishing.gradeC')}</option>
                  <option value="D">{t('refurbishing.gradeD')}</option>
                </select>
              </div>
              <select required value={form.technicianId} onChange={(e) => setForm((f) => ({ ...f, technicianId: e.target.value }))}>
                <option value="">{t('refurbishing.selectTechnician')}</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <textarea placeholder={t('common.notes')} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <button type="submit" className="btn btn-primary">{t('common.add')}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
