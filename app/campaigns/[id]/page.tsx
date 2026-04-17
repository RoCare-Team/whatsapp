'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/hooks/useApi';
import {
  ArrowLeft, RefreshCw, Play, Radio, Zap, GitBranch, ShoppingBag,
  CheckCircle, Clock, XCircle, Send, Eye, Copy, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Types ─────────────────────────────────────────────────────
interface CampaignDetail {
  id: number;
  name: string;
  campaign_type: string;
  status: string;
  template_name: string;
  language: string;
  body_text: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  scheduled_at: string;
}
interface ContactRow {
  id: number;
  name: string;
  phone: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
  sent_at: string | null;
  wamid: string | null;
}
interface Counts { pending: number; sent: number; delivered: number; read: number; failed: number }
interface DailyRow { date: string; sent: number }

// ── Config ────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  broadcast:     { label: 'Broadcast',     color: 'text-purple-700', bg: 'bg-purple-100', icon: <Radio size={12} /> },
  api:           { label: 'API',           color: 'text-blue-700',   bg: 'bg-blue-100',   icon: <Zap size={12} /> },
  drip:          { label: 'Drip',          color: 'text-orange-700', bg: 'bg-orange-100', icon: <GitBranch size={12} /> },
  transactional: { label: 'Transactional', color: 'text-teal-700',   bg: 'bg-teal-100',   icon: <ShoppingBag size={12} /> },
};
const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  running:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
};
const MSG_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: 'text-gray-400',  icon: <Clock size={13} /> },
  sent:      { label: 'Sent',      color: 'text-blue-500',  icon: <Send size={13} /> },
  delivered: { label: 'Delivered', color: 'text-green-500', icon: <CheckCircle size={13} /> },
  read:      { label: 'Read',      color: 'text-purple-500',icon: <Eye size={13} /> },
  failed:    { label: 'Failed',    color: 'text-red-500',   icon: <XCircle size={13} /> },
};

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="card text-center py-4">
      <p className={`text-2xl font-bold ${color}`}>{pct}%</p>
      <p className="text-sm text-gray-500 mt-0.5">{count.toLocaleString()}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CampaignDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [campaign, setCampaign]   = useState<CampaignDetail | null>(null);
  const [counts, setCounts]       = useState<Counts>({ pending:0, sent:0, delivered:0, read:0, failed:0 });
  const [daily, setDaily]         = useState<DailyRow[]>([]);
  const [contacts, setContacts]   = useState<ContactRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [activeTab, setActiveTab] = useState<'all'|'sent'|'delivered'|'read'|'failed'|'pending'>('all');
  const [loading, setLoading]     = useState(true);
  const [showTest, setShowTest]   = useState(false);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async (tab = activeTab, page = 1) => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/campaigns/${id}?status=${tab}&page=${page}&limit=50`);
      if (r.data) {
        setCampaign(r.data.campaign);
        setCounts(r.data.counts);
        setDaily(r.data.daily);
        setContacts(r.data.contacts);
        setPagination(r.data.pagination);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, activeTab]);

  useEffect(() => { load(); }, [load]);

  async function launch() {
    setLaunching(true);
    try {
      const r = await apiFetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
      toast.success(r.data?.message || 'Launched!');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setLaunching(false);
    }
  }

  function switchTab(tab: typeof activeTab) {
    setActiveTab(tab);
    load(tab, 1);
  }

  if (!campaign && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-whatsapp-green border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!campaign) return <p className="text-gray-500 p-8">Campaign not found.</p>;

  const typeCfg  = TYPE_CONFIG[campaign.campaign_type] || TYPE_CONFIG.broadcast;
  const total    = campaign.total_contacts;

  const TABS = [
    { key: 'all',       label: 'All',       count: total },
    { key: 'sent',      label: 'Sent',      count: counts.sent },
    { key: 'delivered', label: 'Delivered', count: counts.delivered },
    { key: 'read',      label: 'Read',      count: counts.read },
    { key: 'failed',    label: 'Failed',    count: counts.failed },
    { key: 'pending',   label: 'Pending',   count: counts.pending },
  ] as const;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/campaigns')}
          className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 min-w-0 truncate">{campaign.name}</h1>
        <div className="flex items-center gap-2">
          {/* Type badge */}
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${typeCfg.bg} ${typeCfg.color}`}>
            {typeCfg.icon} {typeCfg.label}
          </span>
          {/* Status badge */}
          <span className={`badge ${STATUS_COLOR[campaign.status] || 'bg-gray-100 text-gray-600'}`}>
            {campaign.status}
          </span>
          {/* Actions */}
          {campaign.campaign_type === 'api' && (
            <button onClick={() => setShowTest(true)}
              className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
              <Zap size={14} /> Test Campaign
            </button>
          )}
          {campaign.campaign_type !== 'api' && (campaign.status === 'draft' || campaign.status === 'scheduled') && (
            <button onClick={launch} disabled={launching}
              className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5 disabled:opacity-50">
              <Play size={14} /> {launching ? 'Launching...' : 'Launch'}
            </button>
          )}
          <button onClick={() => load()} className="btn-secondary p-2" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <div className="card text-center py-4 col-span-1">
          <p className="text-2xl font-bold text-gray-900">{total.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total</p>
        </div>
        <StatCard label="Sent"      count={campaign.sent_count}      total={total} color="text-blue-600" />
        <StatCard label="Delivered" count={campaign.delivered_count} total={total} color="text-green-600" />
        <StatCard label="Read"      count={campaign.read_count}      total={total} color="text-purple-600" />
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-400">0%</p>
          <p className="text-sm text-gray-500 mt-0.5">0</p>
          <p className="text-xs text-gray-400 mt-0.5">Clicked</p>
        </div>
        <StatCard label="Failed"    count={campaign.failed_count}    total={total} color="text-red-500" />
      </div>

      {/* Info + Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Campaign Info */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm border-b pb-2">Campaign Details</h2>
          {[
            { label: 'Campaign Type', value: typeCfg.label },
            { label: 'Template',      value: campaign.template_name },
            { label: 'Language',      value: campaign.language?.toUpperCase() },
            { label: 'Created At',    value: campaign.created_at ? new Date(campaign.created_at).toLocaleString() : '—' },
            { label: 'Started At',    value: campaign.started_at ? new Date(campaign.started_at).toLocaleString() : '—' },
            { label: 'Completed At',  value: campaign.completed_at ? new Date(campaign.completed_at).toLocaleString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="font-medium text-gray-700 text-right max-w-[60%] truncate">{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="card md:col-span-2">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Messages per day</h2>
          {daily.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="sent" name="Sent" fill="#25D366" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="card p-0 overflow-hidden">
        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-100 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-whatsapp-green text-whatsapp-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                activeTab === t.key ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sent At</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && contacts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading...</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">No records</td></tr>
              ) : (
                contacts.map((c) => {
                  const st = MSG_STATUS[c.status] || MSG_STATUS.pending;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">+{c.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 font-medium ${st.color}`}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {c.sent_at ? new Date(c.sent_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-red-400 text-xs max-w-xs truncate">
                        {c.error || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-400">
              Showing {((pagination.page - 1) * 50) + 1}–{Math.min(pagination.page * 50, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1}
                onClick={() => load(activeTab, pagination.page - 1)}
                className="btn-secondary px-3 py-1 text-xs disabled:opacity-40">Prev</button>
              <button disabled={pagination.page >= pagination.pages}
                onClick={() => load(activeTab, pagination.page + 1)}
                className="btn-secondary px-3 py-1 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Test Campaign Panel */}
      {showTest && (
        <TestPanel campaign={campaign} onClose={() => setShowTest(false)} />
      )}
    </div>
  );
}

// ── Test Campaign Panel ────────────────────────────────────────
// Default values for common variable positions
const VAR_DEFAULTS: Record<string, string> = {
  '1': '$FirstName',
  '2': '$LastName',
  '3': '$Phone',
  '4': '$Email',
  '5': '$CompanyName',
};

function buildDefaultVars(bodyText: string): string {
  const matches = bodyText?.match(/\{\{(\d+)\}\}/g) || [];
  const nums    = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))].sort((a, b) => Number(a) - Number(b));
  if (nums.length === 0) return '{}';
  const obj: Record<string, string> = {};
  for (const n of nums) obj[n] = VAR_DEFAULTS[n] || `Value${n}`;
  return JSON.stringify(obj, null, 2);
}

function TestPanel({ campaign, onClose }: { campaign: CampaignDetail; onClose: () => void }) {
  const defaultVars               = buildDefaultVars(campaign.body_text);
  const [phone, setPhone]         = useState('');
  const [vars, setVars]           = useState(defaultVars);
  const [sending, setSending]     = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || 'YOUR_JWT_TOKEN' : 'YOUR_JWT_TOKEN';
  const endpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/campaigns/${campaign.id}/send`
    : `/api/campaigns/${campaign.id}/send`;

  const curlCmd = `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"${phone || '919876543210'}","variables":${vars}}'`;

  async function sendTest() {
    if (!phone) { toast.error('Enter WhatsApp number'); return; }
    let parsedVars: Record<string, string> = {};
    try { parsedVars = JSON.parse(vars); } catch { toast.error('Variables is not valid JSON'); return; }
    setSending(true);
    try {
      await apiFetch(`/api/campaigns/${campaign.id}/send`, {
        method: 'POST',
        body:   JSON.stringify({ phone, variables: parsedVars }),
      });
      toast.success(`Message sent to ${phone}!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Zap size={18} className="text-blue-500" /> Test API Campaign</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Campaign</p>
              <p className="font-medium text-gray-800 truncate">{campaign.name}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Template</p>
              <p className="font-medium text-gray-800 truncate">{campaign.template_name}</p>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp Number <span className="text-gray-400 font-normal">(with country code, no +)</span>
            </label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="input font-mono" placeholder="919876543210" />
          </div>

          {/* Variables */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Variables <span className="text-gray-400 font-normal">(JSON)</span>
            </label>
            <textarea value={vars} onChange={(e) => setVars(e.target.value)}
              className="input font-mono text-xs resize-none" rows={3}
              placeholder={'{"1": "John", "2": "Order#123"}'} />
          </div>

          {/* cURL preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500">cURL</p>
              <button onClick={() => { navigator.clipboard.writeText(curlCmd); toast.success('cURL copied!'); }}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                <Copy size={12} /> Copy cURL
              </button>
            </div>
            <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
              {curlCmd}
            </pre>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={sendTest} disabled={sending}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
              {sending ? <><RefreshCw size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send Test</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
