'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/hooks/useApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Summary {
  total_messages_sent:     number;
  total_messages_received: number;
  delivery_rate:           number;
  read_rate:               number;
  total_contacts:          number;
  new_contacts_today:      number;
  opted_in_contacts:       number;
  active_campaigns:        number;
  converted_leads:         number;
  messages_failed:         number;
}

const COLORS = ['#25D366', '#128C7E', '#FFB300', '#EF4444'];

export default function AnalyticsPage() {
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [daily, setDaily]       = useState<{ date: string; sent: number; received: number }[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    apiFetch('/api/analytics').then((r) => {
      if (r?.data) {
        setSummary(r.data.summary);
        setDaily(r.data.charts.daily_messages);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-whatsapp-green border-t-transparent rounded-full" />
    </div>
  );

  const pieData = summary ? [
    { name: 'Read',      value: summary.read_rate },
    { name: 'Delivered', value: Math.max(0, summary.delivery_rate - summary.read_rate) },
    { name: 'Sent',      value: Math.max(0, 100 - summary.delivery_rate) },
    { name: 'Failed',    value: summary.messages_failed },
  ] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary && [
          { label: 'Messages Sent',    value: summary.total_messages_sent,     sub: `${summary.total_messages_received} received` },
          { label: 'Delivery Rate',    value: `${summary.delivery_rate}%`,     sub: 'of sent messages' },
          { label: 'Read Rate',        value: `${summary.read_rate}%`,         sub: 'of sent messages' },
          { label: 'Total Contacts',   value: summary.total_contacts,          sub: `+${summary.new_contacts_today} today` },
          { label: 'Opted-in',         value: summary.opted_in_contacts,       sub: 'WhatsApp consent' },
          { label: 'Active Campaigns', value: summary.active_campaigns,        sub: 'running now' },
          { label: 'Converted Leads',  value: summary.converted_leads,         sub: 'total conversions' },
          { label: 'Failed Messages',  value: summary.messages_failed,         sub: 'need attention' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily messages chart */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Messages — Last 7 Days</h2>
          {daily.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent"     name="Sent"     fill="#25D366" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Received" fill="#128C7E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Message status pie */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Message Status Breakdown</h2>
          {pieData.every((d) => d.value === 0) ? (
            <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
