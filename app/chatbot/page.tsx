'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/hooks/useApi';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { ChatbotRule } from '@/types';

const TRIGGER_LABELS: Record<string, string> = {
  keyword:     'Contains keyword',
  contains:    'Contains',
  starts_with: 'Starts with',
  exact:       'Exact match',
  any:         'Any message',
};

export default function ChatbotPage() {
  const [rules, setRules]       = useState<ChatbotRule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState<ChatbotRule | null>(null);

  function load() {
    setLoading(true);
    apiFetch('/api/chatbot').then((r) => setRules(r.data || [])).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function deleteRule(id: number) {
    if (!confirm('Delete this rule?')) return;
    await apiFetch(`/api/chatbot/${id}`, { method: 'DELETE' });
    toast.success('Rule deleted');
    load();
  }

  async function toggleRule(rule: ChatbotRule) {
    await apiFetch(`/api/chatbot/${rule.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...rule, is_active: rule.is_active ? 0 : 1 }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chatbot Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Auto-reply to incoming WhatsApp messages based on keywords</p>
        </div>
        <button onClick={() => { setEditRule(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Rule
        </button>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How it works:</p>
        <p>When a contact sends a message, the bot checks rules in priority order (highest first). First matching rule sends the reply automatically.</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Loading...</p>
      ) : rules.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-600 font-medium">No chatbot rules yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first rule to start automating replies</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className={`card transition-opacity ${rule.is_active ? '' : 'opacity-50'}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                    </span>
                    <span className="text-xs text-gray-400">Priority: {rule.priority}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 font-mono text-yellow-800">
                      &quot;{rule.trigger_value || '*'}&quot;
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="bg-whatsapp-light border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 max-w-xs truncate">
                      {rule.response_text || '[Template]'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleRule(rule)} title={rule.is_active ? 'Disable' : 'Enable'}>
                    {rule.is_active
                      ? <ToggleRight size={22} className="text-whatsapp-green" />
                      : <ToggleLeft size={22} className="text-gray-400" />}
                  </button>
                  <button onClick={() => { setEditRule(rule); setShowModal(true); }}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium">Edit</button>
                  <button onClick={() => deleteRule(rule.id)}
                    className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RuleModal
          rule={editRule}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ---- Rule Modal ----
function RuleModal({ rule, onClose, onSaved }: {
  rule: ChatbotRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    trigger_type:  rule?.trigger_type  || 'keyword',
    trigger_value: rule?.trigger_value || '',
    response_type: rule?.response_type || 'text',
    response_text: rule?.response_text || '',
    priority:      rule?.priority || 0,
    is_active:     rule?.is_active ?? 1,
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (rule) {
        await apiFetch(`/api/chatbot/${rule.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast.success('Rule updated');
      } else {
        await apiFetch('/api/chatbot', { method: 'POST', body: JSON.stringify(form) });
        toast.success('Rule created');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-bold text-lg">{rule ? 'Edit Rule' : 'New Rule'}</h2>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
            <select value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value as 'exact' | 'keyword' | 'contains' | 'starts_with' | 'any' })} className="input">
              <option value="keyword">Contains keyword</option>
              <option value="exact">Exact match</option>
              <option value="starts_with">Starts with</option>
              <option value="any">Any message (default reply)</option>
            </select>
          </div>

          {form.trigger_type !== 'any' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Value</label>
              <input value={form.trigger_value} onChange={(e) => setForm({ ...form, trigger_value: e.target.value })}
                className="input" placeholder={`e.g. "hi", "price", "book"`} required />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Response</label>
            <textarea value={form.response_text} onChange={(e) => setForm({ ...form, response_text: e.target.value })}
              className="input resize-none" rows={4}
              placeholder="Hi! Thanks for reaching out. How can we help you?" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority (higher = checked first)</label>
            <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              className="input" min={0} max={100} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
