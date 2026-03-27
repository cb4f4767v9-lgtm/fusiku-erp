import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiKeysApi, webhooksApi } from '../services/api';
import toast from 'react-hot-toast';
import { Key, Plus, Trash2, Webhook, Copy, Check } from 'lucide-react';

const PERMISSIONS = ['read_inventory', 'create_sales', 'read_reports'];
const WEBHOOK_EVENTS = ['sale.completed', 'repair.completed', 'inventory.updated', 'low_stock.alert'];

export function DeveloperSettingsPage() {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvent, setWebhookEvent] = useState(WEBHOOK_EVENTS[0]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = () => {
    Promise.all([
      apiKeysApi.list().then((r) => setApiKeys(r.data)).catch(() => setApiKeys([])),
      webhooksApi.list().then((r) => setWebhooks(r.data)).catch(() => setWebhooks([]))
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || newKeyPerms.length === 0) {
      toast.error(t('developer.nameAndPermissionRequired'));
      return;
    }
    try {
      const { data } = await apiKeysApi.create({ name: newKeyName.trim(), permissions: newKeyPerms });
      setGeneratedKey(data.key);
      setNewKeyName('');
      setNewKeyPerms([]);
      load();
      toast.success(t('developer.apiKeyCreated'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm(t('developer.revokeKeyConfirm'))) return;
    try {
      await apiKeysApi.revoke(id);
      load();
      toast.success(t('developer.keyRevoked'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const togglePerm = (p: string) => {
    setNewKeyPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      toast.error(t('developer.urlRequired'));
      return;
    }
    try {
      await webhooksApi.create({ url: webhookUrl.trim(), eventType: webhookEvent });
      setWebhookUrl('');
      load();
      toast.success(t('developer.webhookCreated'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm(t('developer.deleteWebhookConfirm'))) return;
    try {
      await webhooksApi.delete(id);
      load();
      toast.success(t('developer.webhookDeleted'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const copyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t('developer.copiedToClipboard'));
    }
  };

  if (loading) return <div className="page-loading">{t('common.loading')}</div>;

  return (
    <div className="page">
      <h1 className="page-title">{t('developer.title')}</h1>
      <p className="page-subtitle">{t('developer.subtitle')}</p>

      {generatedKey && (
        <div className="dev-key-banner" style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 12, marginBottom: 24 }}>
          <strong>{t('developer.newApiKeyCopyNow')}</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <code style={{ flex: 1, padding: 8, background: 'var(--bg-primary)', borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>{generatedKey}</code>
            <button className="btn btn-primary" onClick={copyKey}>{copied ? <Check size={18} /> : <Copy size={18} />} {t('developer.copy')}</button>
            <button className="btn btn-secondary" onClick={() => setGeneratedKey(null)}>{t('developer.dismiss')}</button>
          </div>
        </div>
      )}

      <div className="dev-sections">
        <section className="settings-card">
          <h2><Key size={20} /> {t('developer.apiKeys')}</h2>
          <form onSubmit={createKey} className="form-inline" style={{ marginBottom: 16 }}>
            <input placeholder={t('developer.keyName')} value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} style={{ maxWidth: 200 }} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
              {PERMISSIONS.map((p) => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={newKeyPerms.includes(p)} onChange={() => togglePerm(p)} />
                  {p}
                </label>
              ))}
            </div>
            <button type="submit" className="btn btn-primary"><Plus size={18} /> {t('developer.generate')}</button>
          </form>
          <ul className="settings-card ul">
            {apiKeys.map((k) => (
              <li key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{k.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{k.permissions?.join(', ')}</span>
                  {k.lastUsedAt && <span style={{ marginLeft: 8, fontSize: 11 }}>{t('developer.lastUsed')} {new Date(k.lastUsedAt).toLocaleString()}</span>}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => revokeKey(k.id)}><Trash2 size={14} /> {t('developer.revoke')}</button>
              </li>
            ))}
            {apiKeys.length === 0 && <li>{t('developer.noApiKeys')}</li>}
          </ul>
        </section>

        <section className="settings-card">
          <h2><Webhook size={20} /> {t('developer.webhooks')}</h2>
          <form onSubmit={createWebhook} className="form-inline" style={{ marginBottom: 16 }}>
            <input placeholder={t('developer.webhookUrl')} value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <select value={webhookEvent} onChange={(ev) => setWebhookEvent(ev.target.value)}>
              {WEBHOOK_EVENTS.map((evt) => <option key={evt} value={evt}>{evt}</option>)}
            </select>
            <button type="submit" className="btn btn-primary"><Plus size={18} /> {t('developer.add')}</button>
          </form>
          <ul className="settings-card ul">
            {webhooks.map((w) => (
              <li key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{w.url}</strong>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{w.eventType}</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => deleteWebhook(w.id)}><Trash2 size={14} /> {t('developer.delete')}</button>
              </li>
            ))}
            {webhooks.length === 0 && <li>{t('developer.noWebhooks')}</li>}
          </ul>
        </section>
      </div>

      <div className="settings-card" style={{ marginTop: 24 }}>
        <h2>{t('developer.publicApi')}</h2>
        <p>{t('developer.baseUrl')} <code>{(import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '')}/api/public/v1</code></p>
        <p>{t('developer.authentication')} <code>X-API-Key: your_key</code> or <code>Authorization: Bearer your_key</code></p>
        <p>{t('developer.rateLimit')}</p>
        <p>{t('developer.endpoints')} <code>GET /inventory</code>, <code>GET /devices</code>, <code>POST /sales</code>, <code>GET /reports</code></p>
      </div>
    </div>
  );
}
