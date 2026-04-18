'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/hooks/useApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { IndianRupee, MessageSquare, Gift, TrendingUp } from 'lucide-react';

const USD_TO_INR = 84; // approximate fixed rate
const toINR = (usd: number) => Math.round(usd * USD_TO_INR * 100) / 100;

interface Summary {
  total_conversations:  number;
  total_cost:           number;
  free_tier_used:       number;
  free_tier_remaining:  number;
  paid_conversations:   number;
}

interface CategoryRow {
  conversations: number;
  cost:          number;
}

interface DayRow {
  date:           string;
  marketing:      number;
  utility:        number;
  authentication: number;
  service:        number;
  cost:           number;
}

interface BillingData {
  month:       string;
  summary:     Summary;
  by_category: Record<string, CategoryRow>;
  daily:       DayRow[];
}

const CAT_COLORS: Record<string, string> = {
  MARKETING:      '#EF4444',
  UTILITY:        '#3B82F6',
  AUTHENTICATION: '#F59E0B',
  SERVICE:        '#25D366',
};

const CAT_LABELS: Record<string, string> = {
  MARKETING:      'Marketing',
  UTILITY:        'Utility',
  AUTHENTICATION: 'Authentication',
  SERVICE:        'Service',
};

function monthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    opts.push({ val, label });
  }
  return opts;
}

export default function BillingPage() {
  const [month, setMonth]     = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData]       = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch(`/api/billing?month=${month}`)
      .then((r) => { if (r?.data) setData(r.data); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [month]);

  const pieData = data
    ? Object.entries(data.by_category)
        .filter(([, v]) => v.conversations > 0)
        .map(([cat, v]) => ({ name: CAT_LABELS[cat] || cat, value: v.conversations, color: CAT_COLORS[cat] || '#888' }))
    : [];

  const freePct = data
    ? Math.min(100, Math.round((data.summary.free_tier_used / 1000) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Usage</h1>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
        >
          {monthOptions().map((o) => (
            <option key={o.val} value={o.val}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-whatsapp-green border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Conversations',
                value: data.summary.total_conversations.toLocaleString(),
                sub: 'this month',
                icon: MessageSquare,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
              },
              {
                label: 'Total Cost',
                value: `₹${toINR(data.summary.total_cost).toFixed(2)}`,
                sub: 'approx. at ₹84/USD',
                icon: IndianRupee,
                color: 'text-red-600',
                bg: 'bg-red-50',
              },
              {
                label: 'Free Tier Used',
                value: `${data.summary.free_tier_used} / 1000`,
                sub: `${data.summary.free_tier_remaining} remaining`,
                icon: Gift,
                color: 'text-green-600',
                bg: 'bg-green-50',
              },
              {
                label: 'Paid Conversations',
                value: data.summary.paid_conversations.toLocaleString(),
                sub: 'beyond free tier',
                icon: TrendingUp,
                color: 'text-orange-600',
                bg: 'bg-orange-50',
              },
            ].map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="card">
                <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                  <Icon size={18} className={color} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Free tier progress bar */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Free Tier Usage (1,000 conversations/month)</span>
              <span className="text-sm font-semibold text-gray-900">{freePct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${freePct >= 100 ? 'bg-red-500' : freePct >= 80 ? 'bg-yellow-500' : 'bg-whatsapp-green'}`}
                style={{ width: `${freePct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {freePct < 100
                ? `${data.summary.free_tier_remaining} free conversations left`
                : `Free tier exhausted — all new conversations are billed`}
            </p>
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Daily stacked bar */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Daily Conversations by Type</h2>
              {data.daily.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data for this month</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number, name: string) => [v, CAT_LABELS[name.toUpperCase()] || name]} />
                    <Legend formatter={(v) => CAT_LABELS[v.toUpperCase()] || v} />
                    <Bar dataKey="marketing"      stackId="a" fill={CAT_COLORS.MARKETING}      radius={[0, 0, 0, 0]} />
                    <Bar dataKey="utility"        stackId="a" fill={CAT_COLORS.UTILITY}        radius={[0, 0, 0, 0]} />
                    <Bar dataKey="authentication" stackId="a" fill={CAT_COLORS.AUTHENTICATION} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="service"        stackId="a" fill={CAT_COLORS.SERVICE}        radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category pie */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Conversations by Category</h2>
              {pieData.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No data for this month</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                      labelLine={false}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Conversations']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category breakdown table */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Cost Breakdown by Category</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Conversations</th>
                    <th className="pb-3 font-medium text-right">Cost (USD)</th>
                    <th className="pb-3 font-medium text-right">Avg / Conv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.entries(data.by_category).map(([cat, row]) => (
                    <tr key={cat} className="hover:bg-gray-50">
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ background: CAT_COLORS[cat] || '#888' }}
                          />
                          {CAT_LABELS[cat] || cat}
                        </span>
                      </td>
                      <td className="py-3 text-right font-medium">{row.conversations.toLocaleString()}</td>
                      <td className="py-3 text-right font-medium">₹{toINR(row.cost).toFixed(2)}</td>
                      <td className="py-3 text-right text-gray-500">
                        {row.conversations > 0
                          ? `₹${toINR(row.cost / row.conversations).toFixed(4)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200 font-semibold">
                    <td className="pt-3">Total</td>
                    <td className="pt-3 text-right">{data.summary.total_conversations.toLocaleString()}</td>
                    <td className="pt-3 text-right">₹{toINR(data.summary.total_cost).toFixed(2)}</td>
                    <td className="pt-3 text-right text-gray-500">
                      {data.summary.total_conversations > 0
                        ? `₹${toINR(data.summary.total_cost / data.summary.total_conversations).toFixed(4)}`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily cost table */}
          {data.daily.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Daily Cost Detail</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium text-right">Marketing</th>
                      <th className="pb-3 font-medium text-right">Utility</th>
                      <th className="pb-3 font-medium text-right">Auth</th>
                      <th className="pb-3 font-medium text-right">Service</th>
                      <th className="pb-3 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.daily.map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="py-2">{d.date}</td>
                        <td className="py-2 text-right">{d.marketing || '—'}</td>
                        <td className="py-2 text-right">{d.utility || '—'}</td>
                        <td className="py-2 text-right">{d.authentication || '—'}</td>
                        <td className="py-2 text-right">{d.service || '—'}</td>
                        <td className="py-2 text-right font-medium">₹{toINR(d.cost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
