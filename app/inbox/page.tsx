'use client';
import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/hooks/useApi';
import { Send, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Contact, Message } from '@/types';

export default function InboxPage() {
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [selected, setSelected]   = useState<Contact | null>(null);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [text, setText]           = useState('');
  const [search, setSearch]       = useState('');
  const [sending, setSending]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load contacts that have messages
  useEffect(() => {
    apiFetch('/api/contacts?limit=100').then((r) => setContacts(r.data?.data || []));
  }, []);

  // Load messages when contact selected
  useEffect(() => {
    if (!selected) return;
    apiFetch(`/api/messages?contactId=${selected.id}&limit=50`)
      .then((r) => setMessages(r.data || []));
    const interval = setInterval(() => {
      apiFetch(`/api/messages?contactId=${selected.id}&limit=50`)
        .then((r) => setMessages(r.data || []));
    }, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [selected]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || !selected) return;
    setSending(true);
    try {
      await apiFetch('/api/send-message', {
        method: 'POST',
        body: JSON.stringify({ contactId: selected.id, type: 'text', text }),
      });
      setText('');
      // Refresh messages
      const r = await apiFetch(`/api/messages?contactId=${selected.id}&limit=50`);
      setMessages(r.data || []);
    } catch (err) {
      toast.error('Failed to send: ' + (err instanceof Error ? err.message : 'error'));
    } finally {
      setSending(false);
    }
  }

  const filtered = contacts.filter((c) =>
    (c.name || c.phone).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Contact list */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="input pl-9 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors
                ${selected?.id === c.id ? 'bg-whatsapp-light' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-whatsapp-green text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {(c.name || c.phone).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{c.name || c.phone}</p>
                  <p className="text-xs text-gray-500 truncate">+{c.phone}</p>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No contacts found</p>
          )}
        </div>
      </div>

      {/* Chat window */}
      {selected ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-whatsapp-green text-white flex items-center justify-center font-semibold text-sm">
              {(selected.name || selected.phone).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">{selected.name || selected.phone}</p>
              <p className="text-xs text-gray-500">+{selected.phone}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm shadow-sm
                  ${m.direction === 'outbound'
                    ? 'bg-whatsapp-light text-gray-800 rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'}`}>
                  <p className="break-words">{m.content}</p>
                  <p className={`text-xs mt-1 ${m.direction === 'outbound' ? 'text-gray-500 text-right' : 'text-gray-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.direction === 'outbound' && (
                      <span className="ml-1">
                        {m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 bg-white flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              className="input flex-1"
            />
            <button onClick={sendMessage} disabled={sending || !text.trim()} className="btn-primary px-4">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-5xl mb-3">💬</div>
            <p className="font-medium">Select a contact to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
