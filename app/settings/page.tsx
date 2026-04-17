'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/hooks/useApi';
import { Save, Eye, EyeOff, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [form, setForm] = useState({
    name:            '',
    phone_number_id: '',
    waba_id:         '',
    access_token:    '',
    verify_token:    '',
  });
  const [saving, setSaving]                 = useState(false);
  const [showToken, setShowToken]           = useState(false);
  const [credSource, setCredSource]         = useState<'database' | 'env' | 'none'>('none');
  const [testing, setTesting]               = useState(false);

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
  }, []);

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
      toast.success('Settings saved to database!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving settings');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!form.access_token || !form.waba_id) {
      toast.error('Enter Access Token and WABA ID first');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${form.waba_id}?fields=id,name&access_token=${form.access_token}`
      );
      const data = await res.json();
      if (data.id) {
        toast.success(`Connected! Business: ${data.name || data.id}`);
      } else {
        toast.error(`Error: ${data.error?.message || 'Invalid credentials'}`);
      }
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook`
    : 'https://your-domain.com/api/webhook';

  const isConfigured = !!(form.access_token && form.phone_number_id && form.waba_id);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Credentials source banner */}
      {credSource === 'env' && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-800">Credentials loaded from .env file</p>
            <p className="text-yellow-700 mt-0.5">
              Your credentials are in <code className="bg-yellow-100 px-1 rounded">.env.local</code> but not saved to DB yet.
              Click <strong>Save Settings</strong> below to save them to the database for multi-tenant use.
            </p>
          </div>
        </div>
      )}
      {credSource === 'database' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-600" />
          <p className="text-sm text-green-800 font-medium">Credentials saved in database ✓</p>
        </div>
      )}
      {credSource === 'none' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-800">No credentials configured</p>
            <p className="text-red-700 mt-0.5">Add your Meta WhatsApp API credentials below to start sending messages.</p>
          </div>
        </div>
      )}

      {/* Webhook URL info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <p className="font-semibold text-blue-800 text-sm">Webhook URL — Add this in Meta App Dashboard</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-blue-900 break-all">
            {webhookUrl}
          </code>
          <button onClick={() => copyToClipboard(webhookUrl)} className="text-blue-600 hover:text-blue-800 p-2 flex-shrink-0">
            <Copy size={16} />
          </button>
        </div>
        <p className="text-xs text-blue-600">
          Meta App Dashboard → WhatsApp → Configuration → Webhook URL & Verify Token
        </p>
      </div>

      {/* Settings form */}
      <form onSubmit={save} className="card space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="font-semibold text-gray-900">WhatsApp API Credentials</h2>
          {isConfigured && (
            <button type="button" onClick={testConnection} disabled={testing}
              className="text-sm text-whatsapp-teal hover:text-whatsapp-dark font-medium flex items-center gap-1.5 disabled:opacity-50">
              {testing ? '⏳ Testing...' : '🔌 Test Connection'}
            </button>
          )}
        </div>

        <div>
          <label className="form-label">Business Name</label>
          <input value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input" placeholder="Acme Corp" />
        </div>

        <div>
          <label className="form-label">
            Phone Number ID *
            <span className="text-gray-400 font-normal text-xs ml-2">Meta App → WhatsApp → API Setup</span>
          </label>
          <input value={form.phone_number_id}
            onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
            className="input font-mono" placeholder="930245630177351" required />
        </div>

        <div>
          <label className="form-label">
            WABA ID (WhatsApp Business Account ID) *
            <span className="text-gray-400 font-normal text-xs ml-2">Meta App → WhatsApp → API Setup</span>
          </label>
          <input value={form.waba_id}
            onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
            className="input font-mono" placeholder="1736454720919400" required />
        </div>

        <div>
          <label className="form-label">
            Permanent Access Token *
            <span className="text-gray-400 font-normal text-xs ml-2">System User Token from Meta Business Suite</span>
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              className="input pr-10 font-mono text-xs"
              placeholder="EAAxxxxx..."
              required
            />
            <button type="button" onClick={() => setShowToken((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="form-label">
            Verify Token
            <span className="text-gray-400 font-normal text-xs ml-2">Use this when setting up the webhook</span>
          </label>
          <div className="flex gap-2">
            <input value={form.verify_token} readOnly className="input font-mono bg-gray-50 flex-1" />
            <button type="button" onClick={() => copyToClipboard(form.verify_token)}
              className="btn-secondary px-3 flex-shrink-0">
              <Copy size={16} />
            </button>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="btn-primary flex items-center gap-2 w-full justify-center">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Settings to Database'}
        </button>
      </form>

      {/* Setup guide */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Setup Guide</h2>
        <ol className="space-y-3 text-sm text-gray-600">
          {[
            { step: 'Go to developers.facebook.com → My Apps → Create App → Business type', done: false },
            { step: 'Add WhatsApp product to your app', done: false },
            { step: 'Create or connect a WhatsApp Business Account (WABA)', done: false },
            { step: 'Copy Phone Number ID and WABA ID from API Setup page', done: !!form.phone_number_id && !!form.waba_id },
            { step: 'Generate a Permanent System User Token from Meta Business Suite', done: !!form.access_token },
            { step: 'Add the webhook URL above in WhatsApp → Configuration', done: false },
            { step: 'Subscribe to: messages, message_deliveries, message_reads', done: false },
            { step: 'Save credentials here and click "Test Connection"', done: credSource === 'database' },
          ].map(({ step, done }, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold
                ${done ? 'bg-green-500 text-white' : 'bg-whatsapp-green text-white'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className={done ? 'line-through text-gray-400' : ''}>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
