'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/hooks/useApi';
import {
  Save, Eye, EyeOff, Copy, CheckCircle, AlertTriangle,
  Webhook, RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight,
  Facebook, ChevronRight, X, Phone, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── FB SDK type shim ──────────────────────────────────────────
declare global {
  interface Window {
    FB: {
      init(opts: object): void;
      login(cb: (res: { authResponse?: { accessToken: string } }) => void, opts: object): void;
    };
    fbAsyncInit?: () => void;
  }
}

interface CWHook {
  id:        number;
  name:      string;
  url:       string;
  secret:    string | null;
  is_active: number;
}

interface WABAOption {
  id:            string;
  name:          string;
  business_name: string;
  phone_numbers: { id: string; display_phone_number: string; verified_name: string }[];
}

// ── Meta Connect Modal ────────────────────────────────────────
function MetaConnectModal({
  wabas,
  onConnect,
  onClose,
}: {
  wabas: WABAOption[];
  onConnect: (waba_id: string, phone_number_id: string, business_name: string) => void;
  onClose: () => void;
}) {
  const [selectedWaba, setSelectedWaba] = useState<WABAOption | null>(
    wabas.length === 1 ? wabas[0] : null
  );
  const [selectedPhone, setSelectedPhone] = useState('');

  useEffect(() => {
    if (selectedWaba?.phone_numbers.length === 1) {
      setSelectedPhone(selectedWaba.phone_numbers[0].id);
    } else {
      setSelectedPhone('');
    }
  }, [selectedWaba]);

  function submit() {
    if (!selectedWaba || !selectedPhone) return;
    onConnect(selectedWaba.id, selectedPhone, selectedWaba.business_name);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">Select WhatsApp Account</p>
            <p className="text-xs text-gray-400 mt-0.5">{wabas.length} business account{wabas.length > 1 ? 's' : ''} found</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* WABA selection */}
          {wabas.length > 1 && (
            <div>
              <label className="form-label">WhatsApp Business Account (WABA)</label>
              <div className="space-y-2 mt-1">
                {wabas.map((w) => (
                  <button key={w.id} onClick={() => setSelectedWaba(w)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between
                      ${selectedWaba?.id === w.id
                        ? 'border-whatsapp-green bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'}`}>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{w.name || w.id}</p>
                      <p className="text-xs text-gray-400">{w.business_name} · WABA {w.id}</p>
                    </div>
                    {selectedWaba?.id === w.id && <CheckCircle size={16} className="text-whatsapp-green" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Phone number selection */}
          {selectedWaba && (
            <div>
              <label className="form-label">Phone Number</label>
              {selectedWaba.phone_numbers.length === 0 ? (
                <p className="text-sm text-red-500 mt-1">No verified phone numbers found on this WABA.</p>
              ) : (
                <div className="space-y-2 mt-1">
                  {selectedWaba.phone_numbers.map((p) => (
                    <button key={p.id} onClick={() => setSelectedPhone(p.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3
                        ${selectedPhone === p.id
                          ? 'border-whatsapp-green bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'}`}>
                      <Phone size={15} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{p.display_phone_number}</p>
                        <p className="text-xs text-gray-400">{p.verified_name}</p>
                      </div>
                      {selectedPhone === p.id && <CheckCircle size={16} className="text-whatsapp-green" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!selectedWaba || !selectedPhone}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
            Connect & Auto-Setup
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Connect Result Panel ──────────────────────────────────────
function ConnectResults({ results, onClose }: {
  results: { step: string; status: string; detail?: string }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-900">Setup Complete</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {results.map((r, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg
              ${r.status === 'ok' ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <span className="text-lg leading-none mt-0.5">
                {r.status === 'ok' ? '✅' : '⚠️'}
              </span>
              <div>
                <p className={`text-sm font-semibold ${r.status === 'ok' ? 'text-green-800' : 'text-yellow-800'}`}>
                  {r.step}
                </p>
                {r.detail && <p className="text-xs text-gray-500 mt-0.5">{r.detail}</p>}
              </div>
            </div>
          ))}
          <button onClick={onClose} className="btn-primary w-full mt-2">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────
export default function SettingsPage() {
  const [form, setForm] = useState({
    name:            '',
    phone_number_id: '',
    waba_id:         '',
    access_token:    '',
    verify_token:    '',
  });
  const [saving, setSaving]         = useState(false);
  const [showToken, setShowToken]   = useState(false);
  const [credSource, setCredSource] = useState<'database' | 'env' | 'none'>('none');
  const [testing, setTesting]       = useState(false);

  // Meta OAuth state
  const [fbLoaded, setFbLoaded]       = useState(false);
  const [fbLoading, setFbLoading]     = useState(false);
  const [wabas, setWabas]             = useState<WABAOption[] | null>(null);
  const [fbToken, setFbToken]         = useState('');
  const [connecting, setConnecting]   = useState(false);
  const [connectResults, setConnectResults] = useState<{ step: string; status: string; detail?: string }[] | null>(null);

  // Custom webhooks
  const [hooks, setHooks]               = useState<CWHook[]>([]);
  const [addForm, setAddForm]           = useState({ name: '', url: '', secret: '' });
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [adding, setAdding]             = useState(false);
  const [testingId, setTestingId]       = useState<number | null>(null);

  const APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';

  // Load Facebook JS SDK
  useEffect(() => {
    if (!APP_ID) return;
    if (document.getElementById('facebook-jssdk')) { setFbLoaded(true); return; }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: APP_ID, version: 'v20.0', xfbml: false, cookie: true });
      setFbLoaded(true);
    };
    const script = document.createElement('script');
    script.id  = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    document.body.appendChild(script);
  }, [APP_ID]);

  useEffect(() => {
    apiFetch('/api/workspace').then((r) => {
      if (r.data) {
        setForm({
          name:            r.data.name            || '',
          phone_number_id: r.data.phone_number_id || '',
          waba_id:         r.data.waba_id         || '',
          access_token:    r.data.access_token    || '',
          verify_token:    r.data.verify_token    || '',
        });
        setCredSource(r.data.credentials_source || 'none');
      }
    });
    loadHooks();
  }, []);

  function loadHooks() {
    apiFetch('/api/webhooks').then((r) => setHooks(r.data || []));
  }

  // Step 1: Facebook OAuth → get WABAs
  function loginWithFacebook() {
    if (!window.FB) { toast.error('Facebook SDK not loaded yet'); return; }
    setFbLoading(true);
    window.FB.login((res) => {
      setFbLoading(false);
      if (!res.authResponse?.accessToken) {
        toast.error('Facebook login cancelled or failed');
        return;
      }
      const token = res.authResponse.accessToken;
      setFbToken(token);
      // Fetch WABAs from our backend
      apiFetch('/api/auth/meta', {
        method: 'POST',
        body: JSON.stringify({ access_token: token }),
      }).then((r) => {
        if (!r.data || r.data.length === 0) {
          toast.error('No WhatsApp Business Accounts found on this Facebook account.');
          return;
        }
        setWabas(r.data);
      }).catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to fetch accounts');
      });
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
      return_scopes: true,
    });
  }

  // Step 2: User selects WABA + phone → full connect
  async function handleConnect(waba_id: string, phone_number_id: string, business_name: string) {
    setWabas(null);
    setConnecting(true);
    try {
      const r = await apiFetch('/api/auth/meta/connect', {
        method: 'POST',
        body: JSON.stringify({ access_token: fbToken, waba_id, phone_number_id, business_name }),
      });
      setConnectResults(r.data?.results || []);
      // Refresh workspace form
      apiFetch('/api/workspace').then((wr) => {
        if (wr.data) {
          setForm({
            name:            wr.data.name            || '',
            phone_number_id: wr.data.phone_number_id || '',
            waba_id:         wr.data.waba_id         || '',
            access_token:    wr.data.access_token    || '',
            verify_token:    wr.data.verify_token    || '',
          });
          setCredSource('database');
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connect failed');
    } finally {
      setConnecting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/workspace', {
        method: 'PUT',
        body: JSON.stringify({
          name:            form.name,
          phone_number_id: form.phone_number_id,
          waba_id:         form.waba_id,
          access_token:    form.access_token,
        }),
      });
      setCredSource('database');
      toast.success('Settings saved!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!form.access_token || !form.waba_id) { toast.error('Enter credentials first'); return; }
    setTesting(true);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${form.waba_id}?fields=id,name&access_token=${form.access_token}`
      );
      const data = await res.json();
      if (data.id) toast.success(`Connected! Business: ${data.name || data.id}`);
      else toast.error(`Error: ${data.error?.message || 'Invalid credentials'}`);
    } catch { toast.error('Connection test failed'); }
    finally { setTesting(false); }
  }

  async function addWebhook(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await apiFetch('/api/webhooks', { method: 'POST', body: JSON.stringify(addForm) });
      setAddForm({ name: '', url: '', secret: '' });
      loadHooks();
      toast.success('Webhook added!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally { setAdding(false); }
  }

  async function deleteHook(id: number) {
    if (!confirm('Delete this webhook?')) return;
    await apiFetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    setHooks((h) => h.filter((x) => x.id !== id));
    toast.success('Deleted');
  }

  async function toggleHook(hook: CWHook) {
    await apiFetch(`/api/webhooks/${hook.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: hook.is_active ? 0 : 1 }),
    });
    setHooks((h) => h.map((x) => x.id === hook.id ? { ...x, is_active: hook.is_active ? 0 : 1 } : x));
  }

  async function testHook(hook: CWHook) {
    setTestingId(hook.id);
    try {
      const res = await apiFetch('/api/webhooks/test', {
        method: 'POST',
        body: JSON.stringify({ url: hook.url, secret: hook.secret }),
      });
      toast.success(`Test sent → ${res.data?.status ?? '?'} ${res.data?.statusText ?? ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally { setTestingId(null); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook`
    : 'https://your-domain.com/api/webhook';

  const isConnected  = !!(form.access_token && form.phone_number_id && form.waba_id);
  const isConfigured = isConnected;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* ── Meta Embedded Signup ───────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Facebook size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Connect via Facebook</h2>
            <p className="text-xs text-gray-400">One-click setup — automatically configures webhook & imports templates</p>
          </div>
        </div>

        {!APP_ID && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
            <p className="font-semibold">Set <code className="bg-yellow-100 px-1 rounded">NEXT_PUBLIC_FACEBOOK_APP_ID</code> in your .env to enable this.</p>
          </div>
        )}

        {isConnected ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">WhatsApp Business Connected</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  WABA: {form.waba_id} · Phone ID: {form.phone_number_id}
                </p>
              </div>
            </div>
            {APP_ID && (
              <button
                onClick={loginWithFacebook}
                disabled={!fbLoaded || fbLoading || connecting}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 flex items-center gap-1">
                {(fbLoading || connecting) && <Loader2 size={12} className="animate-spin" />}
                Reconnect
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={loginWithFacebook}
            disabled={!APP_ID || !fbLoaded || fbLoading || connecting}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
            {(fbLoading || connecting)
              ? <><Loader2 size={18} className="animate-spin" /> Connecting...</>
              : <><Facebook size={18} /> Connect WhatsApp Business Account</>}
          </button>
        )}

        <div className="text-xs text-gray-400 space-y-1">
          <p>✓ Automatically detects your WABA ID, Phone Number ID & Access Token</p>
          <p>✓ Subscribes Meta webhook for messages, delivery & read receipts</p>
          <p>✓ Imports all approved templates from Meta into your account</p>
        </div>
      </div>

      {/* Credentials source banner */}
      {credSource === 'env' && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-800">Credentials loaded from .env file</p>
            <p className="text-yellow-700 mt-0.5">
              Credentials are in <code className="bg-yellow-100 px-1 rounded">.env.local</code> but not saved to DB.
              Click <strong>Save Settings</strong> below.
            </p>
          </div>
        </div>
      )}

      {/* Meta Webhook URL */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <p className="font-semibold text-blue-800 text-sm">Your Webhook URL — Add this in Meta App Dashboard</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-blue-900 break-all">
            {webhookUrl}
          </code>
          <button onClick={() => copyToClipboard(webhookUrl)} className="text-blue-600 hover:text-blue-800 p-2 flex-shrink-0">
            <Copy size={16} />
          </button>
        </div>
        <p className="text-xs text-blue-600">Meta App Dashboard → WhatsApp → Configuration → Webhook URL & Verify Token</p>
      </div>

      {/* Manual credentials form */}
      <form onSubmit={save} className="card space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="font-semibold text-gray-900">WhatsApp API Credentials <span className="text-xs font-normal text-gray-400">(manual)</span></h2>
          {isConfigured && (
            <button type="button" onClick={testConnection} disabled={testing}
              className="text-sm text-whatsapp-teal hover:text-whatsapp-dark font-medium flex items-center gap-1.5 disabled:opacity-50">
              {testing ? '⏳ Testing...' : '🔌 Test Connection'}
            </button>
          )}
        </div>

        <div>
          <label className="form-label">Business Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input" placeholder="Acme Corp" />
        </div>
        <div>
          <label className="form-label">Phone Number ID *</label>
          <input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
            className="input font-mono" placeholder="930245630177351" required />
        </div>
        <div>
          <label className="form-label">WABA ID *</label>
          <input value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
            className="input font-mono" placeholder="1736454720919400" required />
        </div>
        <div>
          <label className="form-label">Permanent Access Token *</label>
          <div className="relative">
            <input type={showToken ? 'text' : 'password'} value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              className="input pr-10 font-mono text-xs" placeholder="EAAxxxxx..." required />
            <button type="button" onClick={() => setShowToken((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="form-label">Verify Token <span className="font-normal text-gray-400 text-xs">(copy to Meta webhook setup)</span></label>
          <div className="flex gap-2">
            <input value={form.verify_token} readOnly className="input font-mono bg-gray-50 flex-1" />
            <button type="button" onClick={() => copyToClipboard(form.verify_token)}
              className="btn-secondary px-3 flex-shrink-0"><Copy size={16} /></button>
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="btn-primary flex items-center gap-2 w-full justify-center">
          <Save size={16} />{saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* ── Custom Chatbot Webhooks ──────────────────────────────── */}
      <div className="card space-y-5">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Webhook size={18} className="text-whatsapp-teal" />
          <div>
            <h2 className="font-semibold text-gray-900">Custom Chatbot Webhooks</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Every inbound message is forwarded to all active webhooks in parallel.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-semibold text-gray-700 mb-1.5">Payload your server will receive:</p>
          <pre className="bg-gray-900 text-green-400 rounded p-2 overflow-x-auto leading-relaxed">{`{
  "event": "message.received",
  "workspace_id": 1,
  "contact": { "id": 42, "phone": "919876543210" },
  "message": {
    "wamid": "wamid.xxx",
    "type": "text",
    "content": "Hello!",
    "timestamp": "1700000000"
  }
}`}</pre>
          <p className="text-gray-500 pt-2">
            Reply: <code className="bg-gray-200 px-1 rounded">POST /api/send-message</code>
            {' · '}Signature: <code className="bg-gray-200 px-1 rounded">X-Webhook-Signature: sha256=...</code>
          </p>
        </div>

        {hooks.length > 0 && (
          <div className="space-y-2">
            {hooks.map((hook) => (
              <div key={hook.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors
                  ${hook.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{hook.name}</p>
                  <p className="text-xs text-gray-400 truncate font-mono">{hook.url}</p>
                  {hook.secret && <p className="text-xs text-gray-300 mt-0.5">🔒 Secret configured</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => testHook(hook)} disabled={testingId === hook.id} title="Send test"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-whatsapp-teal hover:bg-green-50 transition-colors disabled:opacity-40">
                    <RefreshCw size={15} className={testingId === hook.id ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => toggleHook(hook)} title={hook.is_active ? 'Disable' : 'Enable'}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-whatsapp-teal hover:bg-green-50 transition-colors">
                    {hook.is_active
                      ? <ToggleRight size={18} className="text-whatsapp-green" />
                      : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => deleteHook(hook.id)} title="Delete"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {hooks.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-2">No webhooks added yet</p>
        )}

        <form onSubmit={addWebhook} className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Plus size={15} /> Add New Webhook</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="input text-sm" placeholder="Name (e.g. My Bot)" required />
            <div className="relative">
              <input type={showAddSecret ? 'text' : 'password'} value={addForm.secret}
                onChange={(e) => setAddForm({ ...addForm, secret: e.target.value })}
                className="input text-sm pr-9 font-mono" placeholder="Secret (optional)" />
              <button type="button" onClick={() => setShowAddSecret((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                {showAddSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <input value={addForm.url} onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
            className="input text-sm font-mono" placeholder="https://your-server.com/webhook" required />
          <button type="submit" disabled={adding} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={15} />{adding ? 'Adding...' : 'Add Webhook'}
          </button>
        </form>
      </div>

      {/* Modals */}
      {wabas && (
        <MetaConnectModal
          wabas={wabas}
          onConnect={handleConnect}
          onClose={() => setWabas(null)}
        />
      )}
      {connectResults && (
        <ConnectResults
          results={connectResults}
          onClose={() => setConnectResults(null)}
        />
      )}
    </div>
  );
}
