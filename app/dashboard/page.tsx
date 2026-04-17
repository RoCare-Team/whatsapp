'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/hooks/useApi';
import { MessageSquare, Users, Megaphone, TrendingUp, CheckCircle, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Summary {
  total_messages_sent: number;
  delivery_rate: number;
  read_rate: number;
  total_contacts: number;
  new_contacts_today: number;
  active_campaigns: number;
  converted_leads: number;
  messages_failed: number;
}

export default function DashboardPage() {
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [chartData, setChartData]   = useState<{ date: string; sent: number; received: number }[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    apiFetch('/api/analytics').then((res) => {
      if (res?.data) {
        setSummary(res.data.summary);
        setChartData(res.data.charts.daily_messages);
      }
    }).finally(() => setLoading(false));
  }, []);

  const stats = summary ? [
    { label: 'Messages Sent',    value: summary.total_messages_sent,  icon: MessageSquare, color: 'text-blue-600',  bg: 'bg-blue-50' },
    { label: 'Total Contacts',   value: summary.total_contacts,        icon: Users,         color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Delivery Rate',    value: `${summary.delivery_rate}%`,   icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Read Rate',        value: `${summary.read_rate}%`,       icon: BookOpen,      color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Active Campaigns', value: summary.active_campaigns,      icon: Megaphone,     color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Converted Leads',  value: summary.converted_leads,       icon: TrendingUp,    color: 'text-teal-600',   bg: 'bg-teal-50' },
  ] : [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-whatsapp-green border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card text-center">
            <div className={`inline-flex p-3 rounded-xl ${bg} mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Messages — Last 7 Days</h2>
        {chartData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No data yet. Send your first message!</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="sent"     name="Sent"     fill="#25D366" radius={[4, 4, 0, 0]} />
              <Bar dataKey="received" name="Received" fill="#128C7E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '➕ Add Contact',    href: '/contacts',   desc: 'Add leads manually or import CSV' },
          { title: '📣 New Campaign',   href: '/campaigns',  desc: 'Send bulk WhatsApp messages' },
          { title: '🤖 Setup Chatbot',  href: '/chatbot',    desc: 'Automate replies with keywords' },
        ].map((item) => (
          <a key={item.href} href={item.href}
            className="card hover:shadow-md transition-shadow cursor-pointer group">
            <p className="font-semibold text-gray-900 group-hover:text-whatsapp-teal">{item.title}</p>
            <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
