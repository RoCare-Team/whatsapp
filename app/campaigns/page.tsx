'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/hooks/useApi';
import { Plus, Play, Radio, Zap, GitBranch, ShoppingBag, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Campaign, Template, Contact } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600',
  scheduled:  'bg-blue-100 text-blue-700',
  running:    'bg-yellow-100 text-yellow-700',
  completed:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
};

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; desc: string }> = {
  broadcast:     { label: 'Broadcast',     color: 'text-purple-700', bg: 'bg-purple-100', icon: <Radio size={12} />,       desc: 'Bulk send to a list of contacts' },
  api:           { label: 'API',           color: 'text-blue-700',   bg: 'bg-blue-100',   icon: <Zap size={12} />,         desc: 'Triggered via external API calls' },
  drip:          { label: 'Drip',          color: 'text-orange-700', bg: 'bg-orange-100', icon: <GitBranch size={12} />,   desc: 'Automated sequence of messages' },
  transactional: { label: 'Transactional', color: 'text-teal-700',   bg: 'bg-teal-100',   icon: <ShoppingBag size={12} />, desc: 'Order & booking confirmations' },
};

const ALL_TYPES = ['all', 'broadcast', 'api', 'drip', 'transactional'] as const;
type FilterType = typeof ALL_TYPES[number];

export default function CampaignsPage() {
  const router                        = useRouter();
  const [campaigns, setCampaigns]     = useState<Campaign[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [filterType, setFilterType]   = useState<FilterType>('all');

  function load() {
    setLoading(true);
    apiFetch('/api/campaigns').then((r) => setCampaigns(r.data || [])).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function launch(id: number) {
    try {
      const r = await apiFetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
      toast.success(r.data?.message || 'Campaign launched!');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Launch failed');
    }
  }

  function deliveryRate(c: Campaign) {
    if (!c.sent_count) return '—';
    return `${Math.round((c.delivered_count / c.sent_count) * 100)}%`;
  }
  function readRate(c: Campaign) {
    if (!c.sent_count) return '—';
    return `${Math.round((c.read_count / c.sent_count) * 100)}%`;
  }

  const filtered = filterType === 'all'
    ? campaigns
    : campaigns.filter((c) => (c as Campaign & { campaign_type?: string }).campaign_type === filterType);

  // Count per type
  const counts = ALL_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = t === 'all' ? campaigns.length : campaigns.filter((c) => (c as Campaign & { campaign_type?: string }).campaign_type === t).length;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {ALL_TYPES.map((t) => {
          const cfg = t === 'all' ? null : TYPE_CONFIG[t];
          const isActive = filterType === t;
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cfg && <span className={cfg.color}>{cfg.icon}</span>}
              <span className="capitalize">{t === 'all' ? 'All' : cfg?.label}</span>
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                isActive ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-400'
              }`}>{counts[t]}</span>
            </button>
          );
        })}
      </div>

      {/* Campaign cards */}
      {loading ? (
        <p className="text-gray-400 text-center py-10">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">📣</div>
          <p className="text-gray-600 font-medium">No {filterType === 'all' ? '' : filterType + ' '}campaigns yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {filterType === 'all'
              ? 'Create a campaign to send bulk WhatsApp messages'
              : `No ${TYPE_CONFIG[filterType]?.label} campaigns found`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((c) => {
            const cType = (c as Campaign & { campaign_type?: string }).campaign_type || 'broadcast';
            const typeCfg = TYPE_CONFIG[cType] || TYPE_CONFIG.broadcast;
            return (
              <div key={c.id} className="card cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/campaigns/${c.id}`)}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{c.name}</h3>
                      {/* Campaign type badge */}
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${typeCfg.bg} ${typeCfg.color}`}>
                        {typeCfg.icon}
                        {typeCfg.label}
                      </span>
                      {/* Status badge */}
                      <span className={`badge ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">Template: {c.template_name || c.template_id}</p>
                    {c.scheduled_at && (
                      <p className="text-sm text-gray-400 mt-0.5">
                        Scheduled: {new Date(c.scheduled_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-sm">
                    {[
                      { label: 'Total',     value: c.total_contacts },
                      { label: 'Sent',      value: c.sent_count,      color: 'text-blue-600' },
                      { label: 'Delivered', value: deliveryRate(c),   color: 'text-green-600' },
                      { label: 'Read',      value: readRate(c),       color: 'text-purple-600' },
                      { label: 'Failed',    value: c.failed_count,    color: 'text-red-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <p className={`font-semibold ${color || 'text-gray-900'}`}>{value}</p>
                        <p className="text-gray-400 text-xs">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {cType === 'api' ? (
                      <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
                        <Zap size={12} /> Call via API
                      </span>
                    ) : (c.status === 'draft' || c.status === 'scheduled') && (
                      <button onClick={() => launch(c.id)}
                        className="btn-primary flex items-center gap-1 text-sm px-3 py-1.5">
                        <Play size={14} /> Launch
                      </button>
                    )}
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </div>

                {/* Progress bar for running campaign */}
                {c.status === 'running' && c.total_contacts > 0 && (
                  <div className="mt-4">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-whatsapp-green rounded-full transition-all"
                        style={{ width: `${Math.round((c.sent_count / c.total_contacts) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {c.sent_count}/{c.total_contacts} sent
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CampaignModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}

// ---- Campaign Creation Modal ----
function CampaignModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [templates, setTemplates]     = useState<Template[]>([]);
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [createdId, setCreatedId]     = useState<number | null>(null);
  const [form, setForm]               = useState({
    name: '', template_id: '', scheduled_at: '', campaign_type: 'broadcast',
  });
  const [saving, setSaving] = useState(false);

  const isApi = form.campaign_type === 'api';

  useEffect(() => {
    apiFetch('/api/templates').then((r) => setTemplates(r.data?.filter((t: Template) => t.status === 'APPROVED') || []));
    if (!isApi) {
      apiFetch('/api/contacts?limit=500').then((r) => setContacts(r.data?.data || []));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.campaign_type]);

  function toggleContact(id: number) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isApi && selectedIds.length === 0) {
      toast.error('Select at least one contact');
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch('/api/campaigns', {
        method: 'POST',
        body:   JSON.stringify({
          name:          form.name,
          template_id:   Number(form.template_id),
          scheduled_at:  form.scheduled_at || undefined,
          campaign_type: form.campaign_type,
          contact_ids:   isApi ? [] : selectedIds,
        }),
      });
      if (isApi) {
        setCreatedId(r.data?.id);
      } else {
        toast.success('Campaign created!');
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  const apiEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/campaigns/${createdId}/send`
    : `/api/campaigns/${createdId}/send`;

  // ── After API campaign created: show endpoint info ──────────
  if (createdId) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="p-6 border-b border-gray-200 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <h2 className="font-bold text-lg">API Campaign Created!</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Use this endpoint to send messages from your backend/system:
            </p>

            <div className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-green-400 space-y-1 overflow-x-auto">
              <p className="text-gray-400">POST {apiEndpoint}</p>
              <p className="text-gray-400">Authorization: Bearer YOUR_JWT_TOKEN</p>
              <p className="text-gray-400">Content-Type: application/json</p>
              <br />
              <p>{'{'}</p>
              <p>&nbsp;&nbsp;&quot;phone&quot;: &quot;919876543210&quot;,</p>
              <p>&nbsp;&nbsp;&quot;variables&quot;: {'{'}&quot;1&quot;: &quot;John&quot;, &quot;2&quot;: &quot;Order#123&quot;{'}'}</p>
              <p>{'}'}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p><strong>phone</strong> — recipient number with country code (no +)</p>
              <p><strong>variables</strong> — template variables like {`{{1}}`}, {`{{2}}`}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { navigator.clipboard.writeText(`POST ${apiEndpoint}`); toast.success('Copied!'); }}
                className="btn-secondary flex-1 text-sm">Copy URL</button>
              <button onClick={onSaved} className="btn-primary flex-1 text-sm">Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-bold text-lg">New Campaign</h2>
        </div>
        <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input" placeholder="e.g. Diwali Offer 2024" required />
          </div>

          {/* Campaign Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <label key={key} className={`flex items-start gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  form.campaign_type === key
                    ? 'border-whatsapp-green bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" name="campaign_type" value={key}
                    checked={form.campaign_type === key}
                    onChange={() => setForm({ ...form, campaign_type: key })}
                    className="mt-0.5 accent-green-600" />
                  <div>
                    <div className={`flex items-center gap-1 text-sm font-medium ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{cfg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template * (Approved only)</label>
            <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}
              className="input" required>
              <option value="">Select template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No approved templates. Create and get a template approved first.</p>
            )}
          </div>

          {/* API type: show info box instead of contacts/schedule */}
          {isApi ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Zap size={14} /> API Campaign — No contacts needed
              </p>
              <p className="text-xs text-blue-600">
                Campaign create hone ke baad ek API endpoint milega. Aap us endpoint ko apne backend se call karke
                kisi bhi number pe message bhej sakte ho — manually contacts select karne ki zaroorat nahi.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
                <input type="datetime-local" value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="input" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Contacts ({selectedIds.length} selected)
                </label>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  <label className="flex items-center gap-3 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100">
                    <input type="checkbox"
                      checked={selectedIds.length === contacts.length && contacts.length > 0}
                      onChange={(e) => setSelectedIds(e.target.checked ? contacts.map((c) => c.id) : [])}
                    />
                    <span className="text-sm font-medium">Select All ({contacts.length})</span>
                  </label>
                  {contacts.length === 0 && (
                    <p className="text-xs text-gray-400 px-3 py-4 text-center">
                      No contacts yet. Add contacts first from the Contacts page.
                    </p>
                  )}
                  {contacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleContact(c.id)} />
                      <span className="text-sm">{c.name || c.phone} <span className="text-gray-400">+{c.phone}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Creating...' : isApi ? 'Create & Get API' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
