'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/hooks/useApi';
import { Send, Search, FileText, Image, FileVideo, File, ChevronDown, ChevronUp, Download, Music, MapPin, User, UserCheck, CheckCircle, Loader2, LayoutTemplate, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Contact, Message } from '@/types';

// ── Template bubble types ─────────────────────────────────────
interface TemplateContent {
  __type: 'template';
  template_name: string;
  header_type: string;
  header_content: string;
  body: string;
  footer: string;
  buttons: { type: string; text: string }[];
}
function parseTemplateContent(content: string): TemplateContent | null {
  try {
    const p = JSON.parse(content);
    if (p.__type === 'template') return p as TemplateContent;
  } catch { /**/ }
  return null;
}

// ── Media message types ───────────────────────────────────────
interface MediaContent {
  __type: 'media';
  media_id: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
  workspace_id: number;
}
function parseMediaContent(content: string): MediaContent | null {
  try {
    const p = JSON.parse(content);
    if (p.__type === 'media' && p.media_id) return p as MediaContent;
  } catch { /**/ }
  return null;
}

function MediaBubble({ data, msgType }: { data: MediaContent; msgType: string }) {
  const src = `/api/media/${data.media_id}?workspaceId=${data.workspace_id}`;
  const isImage = msgType === 'image';
  const isAudio = msgType === 'audio';
  const isVideo = msgType === 'video';
  const isDoc   = msgType === 'document';

  return (
    <div className="max-w-xs">
      {isImage && (
        <img
          src={src}
          alt={data.caption || 'Image'}
          className="rounded-xl max-w-full max-h-64 object-cover"
          loading="lazy"
        />
      )}
      {isVideo && (
        <video
          src={src}
          controls
          className="rounded-xl max-w-full max-h-64"
        />
      )}
      {isAudio && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white/50 rounded-xl">
          <Music size={16} className="text-gray-500 flex-shrink-0" />
          <audio src={src} controls className="h-8 w-48" />
        </div>
      )}
      {isDoc && (
        <a
          href={src}
          download={data.filename || 'document'}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-white/50 rounded-xl hover:bg-white/80 transition-colors"
        >
          <FileText size={16} className="text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-700 truncate max-w-[180px]">{data.filename || 'Document'}</span>
          <Download size={14} className="text-gray-400 flex-shrink-0 ml-auto" />
        </a>
      )}
      {data.caption && (
        <p className="text-xs text-gray-600 mt-1 px-1 break-words">{data.caption}</p>
      )}
    </div>
  );
}

// ── Location message ─────────────────────────────────────────
interface LocationContent { __type: 'location'; latitude: number; longitude: number; name?: string; address?: string }
function parseLocationContent(c: string): LocationContent | null {
  try { const p = JSON.parse(c); if (p.__type === 'location') return p; } catch { /**/ } return null;
}
function LocationBubble({ data }: { data: LocationContent }) {
  const url = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="flex items-start gap-2 hover:opacity-80 transition-opacity">
      <div className="w-24 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 relative">
        <img
          src={`https://maps.googleapis.com/maps/api/staticmap?center=${data.latitude},${data.longitude}&zoom=15&size=96x80&markers=${data.latitude},${data.longitude}&key=`}
          alt="map"
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <MapPin size={20} className="absolute inset-0 m-auto text-red-500" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{data.name || 'Location'}</p>
        {data.address && <p className="text-xs text-gray-500 mt-0.5 break-words">{data.address}</p>}
        <p className="text-xs text-blue-500 mt-1">Open in Maps ↗</p>
      </div>
    </a>
  );
}

// ── Contact message ───────────────────────────────────────────
interface ContactEntry { name?: { formatted_name?: string }; phones?: { phone?: string }[]; }
interface ContactsContent { __type: 'contacts'; contacts: ContactEntry[] }
function parseContactsContent(c: string): ContactsContent | null {
  try { const p = JSON.parse(c); if (p.__type === 'contacts') return p; } catch { /**/ } return null;
}
function ContactsBubble({ data }: { data: ContactsContent }) {
  return (
    <div className="space-y-1.5">
      {data.contacts?.map((ct, i) => {
        const name  = ct.name?.formatted_name || 'Contact';
        const phone = ct.phones?.[0]?.phone || '';
        return (
          <div key={i} className="flex items-center gap-2 bg-white/50 rounded-xl px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
              {phone && <p className="text-xs text-gray-500">{phone}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── WhatsApp template bubble ──────────────────────────────────
function TemplateBubble({ data, status, time }: { data: TemplateContent; status: string; time: string }) {
  const HeaderIcon = data.header_type === 'IMAGE' ? Image
    : data.header_type === 'VIDEO'    ? FileVideo
    : data.header_type === 'DOCUMENT' ? File : FileText;

  return (
    <div className="w-72 rounded-2xl rounded-br-sm overflow-hidden shadow-sm border border-green-100">
      {data.header_type && data.header_type !== 'NONE' && (
        <div className="bg-gray-100 px-4 py-2.5">
          {data.header_type === 'TEXT'
            ? <p className="font-bold text-gray-800 text-sm">{data.header_content}</p>
            : <div className="flex items-center gap-2 text-gray-500 text-sm"><HeaderIcon size={15} /><span>{data.header_type}</span></div>}
        </div>
      )}
      <div className="bg-[#dcf8c6] px-4 py-2.5">
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">{data.body}</p>
        {data.footer && <p className="text-xs text-gray-400 mt-1.5">{data.footer}</p>}
        <p className="text-xs text-gray-400 text-right mt-1">
          {time}
          <span className={`ml-1 ${status === 'read' ? 'text-blue-500' : 'text-gray-400'}`}>
            {status === 'read' || status === 'delivered' ? '✓✓' : '✓'}
          </span>
        </p>
      </div>
      {data.buttons?.length > 0 && (
        <div className="divide-y divide-gray-200 border-t border-gray-200">
          {data.buttons.map((btn, i) => (
            <div key={i} className="bg-white px-4 py-2 text-center text-sm font-medium text-[#00a5f4]">{btn.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contact Profile Panel ─────────────────────────────────────
function ProfilePanel({ contact, msgCount }: { contact: Contact; msgCount: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ info: true });
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const initial = (contact.name || contact.phone || '?').charAt(0).toUpperCase();
  const avatarColors = ['bg-orange-400', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-400'];
  const color = avatarColors[initial.charCodeAt(0) % avatarColors.length];

  const chatStatusBadge = contact.chat_status === 'intervened'
    ? <span className="text-orange-600 font-semibold">Intervened</span>
    : contact.chat_status === 'resolved'
    ? <span className="text-green-600 font-semibold">Resolved</span>
    : <span className="text-gray-600 font-semibold">Open</span>;

  const infoRows = [
    { label: 'Status',            value: <span className={`font-semibold ${contact.status === 'converted' ? 'text-green-600' : 'text-gray-700'}`}>{contact.status || 'Active'}</span> },
    { label: 'Chat Status',       value: chatStatusBadge },
    ...(contact.chat_status === 'intervened' && contact.intervened_by
      ? [{ label: 'Intervened By', value: <span className="font-semibold text-orange-600">{contact.intervened_by}</span> }]
      : []),
    { label: 'Last Active',       value: contact.updated_at ? new Date(contact.updated_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—' },
    { label: 'Template Messages', value: msgCount },
    { label: 'Session Messages',  value: msgCount },
    { label: 'Source',            value: contact.source || '—' },
    { label: 'Opted In',          value: contact.opted_in ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-red-400">No</span> },
  ];

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
      {/* Avatar + name */}
      <div className="p-5 border-b border-gray-100 text-center">
        <div className={`w-14 h-14 rounded-full ${color} text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3`}>
          {initial}
        </div>
        <p className="font-bold text-gray-900">{contact.name || contact.phone}</p>
        <p className="text-sm text-gray-400 mt-0.5">+{contact.phone}</p>
      </div>

      {/* Info section */}
      <div className="border-b border-gray-100">
        <button onClick={() => toggle('info')}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Chat Profile
          {open.info ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {open.info && (
          <div className="px-4 pb-4 space-y-2.5">
            {infoRows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-700 text-right">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="border-b border-gray-100">
        <button onClick={() => toggle('tags')}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Tags
          {open.tags ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {open.tags && (
          <div className="px-4 pb-4">
            {contact.tags && (Array.isArray(contact.tags) ? contact.tags : (() => { try { return JSON.parse(contact.tags as string); } catch { return []; } })()).length > 0
              ? (Array.isArray(contact.tags) ? contact.tags : JSON.parse(contact.tags as string)).map((t: string, i: number) => (
                <span key={i} className="inline-block bg-blue-100 text-blue-700 text-xs rounded-full px-2.5 py-0.5 mr-1 mb-1">{t}</span>
              ))
              : <p className="text-xs text-gray-400">No tags</p>}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="border-b border-gray-100">
        <button onClick={() => toggle('notes')}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Notes
          {open.notes ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {open.notes && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-400">{contact.notes || 'No notes'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Inbox Page ───────────────────────────────────────────
export default function InboxPage() {
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [selected, setSelected]     = useState<Contact | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [text, setText]             = useState('');
  const [search, setSearch]         = useState('');
  const [sending, setSending]       = useState(false);
  const [actioning, setActioning]   = useState(false);
  const [tab, setTab]               = useState<'all' | 'unread'>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates]   = useState<{ id: number; name: string; language: string; body_text: string; status: string }[]>([]);
  const [sendingTpl, setSendingTpl] = useState<number | null>(null);
  // Persist read timestamps in localStorage: { contactId: ISO timestamp }
  const [readAt, setReadAt] = useState<Record<number, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('inbox_read_at') || '{}');
    } catch { return {}; }
  });
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const chatRef                     = useRef<HTMLDivElement>(null);

  const loadContacts = useCallback(() => {
    apiFetch('/api/contacts?limit=200&chatStatus=active').then((r) => setContacts(r.data?.data || []));
  }, []);

  useEffect(() => {
    loadContacts();
    const iv = setInterval(loadContacts, 10000); // refresh unread counts every 10s
    return () => clearInterval(iv);
  }, [loadContacts]);

  const loadMessages = useCallback((contactId: number) => {
    apiFetch(`/api/messages?contactId=${contactId}&limit=80`).then((r) => setMessages(r.data || []));
  }, []);

  const loadTemplates = useCallback(() => {
    if (templates.length > 0) return;
    apiFetch('/api/templates').then((r) => {
      const approved = (r.data || []).filter((t: { status: string }) => t.status === 'APPROVED');
      setTemplates(approved);
    });
  }, [templates.length]);

  // 24h session: check if last inbound message is within 24 hours
  const isSessionOpen = messages.some((m) =>
    m.direction === 'inbound' && Date.now() - new Date(m.created_at).getTime() < 24 * 60 * 60 * 1000
  );

  function selectContact(c: Contact) {
    setSelected(c);
    // Store current time as "read at" for this contact
    const updated = { ...readAt, [c.id]: new Date().toISOString() };
    setReadAt(updated);
    localStorage.setItem('inbox_read_at', JSON.stringify(updated));
  }

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    const iv = setInterval(() => loadMessages(selected.id), 5000);
    return () => clearInterval(iv);
  }, [selected, loadMessages]);

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
      loadMessages(selected.id);
    } catch (err) {
      toast.error('Failed: ' + (err instanceof Error ? err.message : 'error'));
    } finally {
      setSending(false);
    }
  }

  async function sendTemplate(templateName: string, language: string, tplId: number) {
    if (!selected) return;
    setSendingTpl(tplId);
    try {
      await apiFetch('/api/send-message', {
        method: 'POST',
        body: JSON.stringify({ contactId: selected.id, type: 'template', templateName, language }),
      });
      setShowTemplates(false);
      loadMessages(selected.id);
      toast.success('Template sent!');
    } catch (err) {
      toast.error('Failed: ' + (err instanceof Error ? err.message : 'error'));
    } finally {
      setSendingTpl(null);
    }
  }

  async function intervene() {
    if (!selected || actioning) return;
    setActioning(true);
    try {
      await apiFetch(`/api/contacts/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ chat_status: 'intervened' }),
      });
      const updated = { ...selected, chat_status: 'intervened' as const };
      setSelected(updated);
      setContacts((prev) => prev.map((c) => c.id === selected.id ? updated : c));
    } catch { toast.error('Failed to intervene'); }
    finally { setActioning(false); }
  }

  async function resolve() {
    if (!selected || actioning) return;
    setActioning(true);
    try {
      await apiFetch(`/api/contacts/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ chat_status: 'resolved' }),
      });
      setContacts((prev) => prev.filter((c) => c.id !== selected.id));
      setSelected(null);
      setMessages([]);
      toast.success('Chat resolved and moved to History');
    } catch { toast.error('Failed to resolve'); }
    finally { setActioning(false); }
  }

  function scrollToReplied(wamid: string) {
    const el = document.getElementById(`msg-${wamid}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-whatsapp-green', 'ring-offset-1', 'rounded-xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-whatsapp-green', 'ring-offset-1', 'rounded-xl'), 1500);
    }
  }

  const filtered = contacts.filter((c) =>
    (c.name || c.phone).toLowerCase().includes(search.toLowerCase())
  );

  const templateMsgCount = messages.filter((m) => m.type === 'template').length;

  return (
    <div className="h-[calc(100vh-5rem)] flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">

      {/* ── Left: Contact List ──────────────────────────────── */}
      <div className="w-72 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..." className="input pl-9 text-sm py-2" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['all', 'unread'] as const).map((t) => {
            const unreadCount = contacts.filter((c) => {
              if (!Number(c.unread_count)) return false;
              const viewedAt = readAt[c.id];
              if (!viewedAt) return true;
              return c.last_message_at && new Date(c.last_message_at) > new Date(viewedAt);
            }).length;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors flex items-center justify-center gap-1.5 ${
                  tab === t ? 'border-b-2 border-whatsapp-green text-whatsapp-teal' : 'text-gray-400'}`}>
                {t === 'all' ? `All (${contacts.length})` : (
                  <>Unread {unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{unreadCount}</span>}</>
                )}
              </button>
            );
          })}
        </div>

        {/* Contact items */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-xs py-10">No contacts</p>
          )}
          {filtered
            .filter((c) => {
              if (tab === 'all') return true;
              if (!Number(c.unread_count)) return false;
              const viewedAt = readAt[c.id];
              if (!viewedAt) return true;
              return c.last_message_at && new Date(c.last_message_at) > new Date(viewedAt);
            })
            .map((c) => {
            const viewedAt = readAt[c.id];
            const unread = (() => {
              if (!Number(c.unread_count)) return 0;
              if (!viewedAt) return Number(c.unread_count);
              return c.last_message_at && new Date(c.last_message_at) > new Date(viewedAt)
                ? Number(c.unread_count) : 0;
            })();
            const initial = (c.name || c.phone).charAt(0).toUpperCase();
            const avatarColors = ['bg-orange-400','bg-purple-500','bg-blue-500','bg-green-500','bg-red-400'];
            const color = avatarColors[initial.charCodeAt(0) % avatarColors.length];
            return (
              <button key={c.id} onClick={() => selectContact(c)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center gap-3
                  ${selected?.id === c.id ? 'bg-green-50 border-l-2 border-l-whatsapp-green' : ''}`}>
                <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {c.name || c.phone}
                    </p>
                    {c.last_message_at && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      +{c.phone}
                    </p>
                    {unread > 0 && (
                      <span className="flex-shrink-0 bg-whatsapp-green text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Middle: Chat area ───────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 bg-white">
            <div className="w-9 h-9 rounded-full bg-whatsapp-green text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(selected.name || selected.phone).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">{selected.name || selected.phone}</p>
              <p className="text-xs text-gray-400">+{selected.phone}</p>
            </div>
            {selected.chat_status === 'intervened' && (
              <button onClick={resolve} disabled={actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                {actioning ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Resolve
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f0f0]" ref={chatRef}
            style={{ backgroundImage: 'radial-gradient(circle, #d4d4d4 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {messages.map((m) => {
              const tpl      = parseTemplateContent(m.content);
              const media    = parseMediaContent(m.content);
              const location = parseLocationContent(m.content);
              const contacts = parseContactsContent(m.content);
              const repliedMsg = m.replied_to_wamid ? messages.find((x) => x.wamid === m.replied_to_wamid) : null;
              const timeStr    = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={m.id} id={`msg-${m.wamid}`}
                  className={`flex transition-all ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  {tpl ? (
                    <TemplateBubble data={tpl} status={m.status} time={timeStr} />
                  ) : (
                    <div className={`max-w-xs lg:max-w-sm rounded-2xl text-sm shadow-sm overflow-hidden
                      ${m.direction === 'outbound'
                        ? 'bg-[#dcf8c6] text-gray-800 rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm'}`}>

                      {/* Reply reference — with linked message or fallback to last template */}
                      {m.type === 'button' && (() => {
                        const quotedMsg = repliedMsg || messages.slice().reverse().find(
                          (x) => x.direction === 'outbound' && x.type === 'template' && x.id < m.id
                        );
                        const quotedTpl = quotedMsg ? parseTemplateContent(quotedMsg.content) : null;
                        return (
                          <button
                            onClick={() => quotedMsg?.wamid && scrollToReplied(quotedMsg.wamid)}
                            className="w-full text-left bg-black/10 border-l-4 border-whatsapp-green px-3 py-2 hover:bg-black/15 transition-colors">
                            <p className="text-whatsapp-teal font-semibold text-xs flex items-center gap-1 mb-0.5">
                              ↩ Replied to this message
                            </p>
                            <p className="text-gray-600 text-xs truncate">
                              {quotedTpl?.body?.slice(0, 55) || quotedMsg?.content?.slice(0, 55) || 'Template message'}
                              {((quotedTpl?.body?.length || 0) > 55) && '…'}
                            </p>
                          </button>
                        );
                      })()}

                      <div className="px-3 py-2">
                        {media ? (
                          <MediaBubble data={media} msgType={m.type} />
                        ) : location ? (
                          <LocationBubble data={location} />
                        ) : contacts ? (
                          <ContactsBubble data={contacts} />
                        ) : (
                          <p className="break-words whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        )}
                        <p className={`text-xs mt-1 flex items-center gap-0.5 ${m.direction === 'outbound' ? 'justify-end text-gray-400' : 'text-gray-300'}`}>
                          {timeStr}
                          {m.direction === 'outbound' && (
                            <span className={m.status === 'read' ? 'text-blue-500' : 'text-gray-400'}>
                              {m.status === 'read' || m.status === 'delivered' ? ' ✓✓' : ' ✓'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Template picker panel */}
          {showTemplates && (
            <div className="border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Select a Template</p>
                <button onClick={() => setShowTemplates(false)}><X size={16} className="text-gray-400 hover:text-gray-600" /></button>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                {templates.length === 0
                  ? <p className="text-center text-xs text-gray-400 py-6">No approved templates</p>
                  : templates.map((t) => (
                    <button key={t.id} onClick={() => sendTemplate(t.name, t.language, t.id)}
                      disabled={sendingTpl === t.id}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                        {sendingTpl === t.id
                          ? <Loader2 size={14} className="animate-spin text-gray-400" />
                          : <Send size={13} className="text-gray-300" />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{t.body_text}</p>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Input / Intervene */}
          {selected.chat_status === 'intervened' ? (
            isSessionOpen ? (
              <div className="p-3 border-t border-gray-200 bg-white flex gap-2 items-center">
                <input value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="input flex-1 text-sm" />
                <button onClick={() => { loadTemplates(); setShowTemplates((v) => !v); }}
                  title="Send template"
                  className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
                  <LayoutTemplate size={16} />
                </button>
                <button onClick={sendMessage} disabled={sending || !text.trim()}
                  className="btn-primary px-4 py-2.5 disabled:opacity-50">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            ) : (
              <div className="border-t border-gray-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-amber-500" />
                  <p className="text-xs text-amber-700 font-medium">24-hour session expired — send a template to reopen</p>
                </div>
                <button onClick={() => { loadTemplates(); setShowTemplates((v) => !v); }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-whatsapp-green hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors">
                  <LayoutTemplate size={15} />
                  Send Template
                </button>
              </div>
            )
          ) : (
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-center">
              <button onClick={intervene} disabled={actioning}
                className="flex items-center gap-2 px-6 py-2.5 bg-whatsapp-green hover:bg-green-600 text-white font-semibold rounded-full text-sm transition-colors disabled:opacity-50 shadow-sm">
                {actioning ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                Intervene
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50">
          <div className="text-center">
            <div className="text-5xl mb-3">💬</div>
            <p className="font-medium text-gray-500">Select a contact to start chatting</p>
            <p className="text-sm text-gray-400 mt-1">Choose from the contact list on the left</p>
          </div>
        </div>
      )}

      {/* ── Right: Profile Panel ────────────────────────────── */}
      {selected && (
        <ProfilePanel contact={selected} msgCount={templateMsgCount} />
      )}
    </div>
  );
}
