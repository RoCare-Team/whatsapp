/**
 * lib/whatsapp.ts
 * Meta WhatsApp Cloud API wrapper
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
import axios, { AxiosInstance } from 'axios';

const API_VERSION = 'v19.0';
const BASE_URL    = `https://graph.facebook.com/${API_VERSION}`;

// ---- Create axios instance for a specific workspace ----
export function createWAClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

// ---- Send plain text message ----
export async function sendTextMessage(
  accessToken:   string,
  phoneNumberId: string,
  to:            string,
  text:          string
) {
  const client = createWAClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to,
    type:              'text',
    text:              { preview_url: false, body: text },
  });
  return data; // { messages: [{ id: 'wamid...' }] }
}

// ---- Send template message ----
export async function sendTemplateMessage(
  accessToken:   string,
  phoneNumberId: string,
  to:            string,
  templateName:  string,
  language:      string,
  components:    object[] = []
) {
  const client = createWAClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type:     'template',
    template: {
      name:       templateName,
      language:   { code: language },
      components,
    },
  });
  return data;
}

// ---- Send image message ----
export async function sendImageMessage(
  accessToken:   string,
  phoneNumberId: string,
  to:            string,
  imageUrl:      string,
  caption?:      string
) {
  const client = createWAClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type:  'image',
    image: { link: imageUrl, caption },
  });
  return data;
}

// ---- Mark message as read ----
export async function markAsRead(
  accessToken:   string,
  phoneNumberId: string,
  messageId:     string
) {
  const client = createWAClient(accessToken);
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status:            'read',
    message_id:        messageId,
  });
  return data;
}

// ---- Submit template to Meta for approval ----
export async function submitTemplate(
  accessToken: string,
  wabaId:      string,
  template: {
    name:       string;
    language:   string;
    category:   string;
    components: object[];
  }
) {
  const client = createWAClient(accessToken);
  const { data } = await client.post(`/${wabaId}/message_templates`, template);
  return data; // { id: '...', status: 'PENDING' }
}

// ---- Get all templates from Meta ----
export async function getMetaTemplates(accessToken: string, wabaId: string) {
  const client = createWAClient(accessToken);
  const { data } = await client.get(`/${wabaId}/message_templates?fields=id,name,status,language,category,components`);
  return data.data;
}

// ---- Parse incoming webhook payload ----
export interface IncomingMessage {
  wamid:      string;
  from:       string;  // phone number
  timestamp:  string;
  type:       string;
  text?:      string;
  image?:     object;
  audio?:     object;
  document?:  object;
  video?:     object;
  interactive?: object;
  button?:    { text: string; payload: string };
}

export interface StatusUpdate {
  wamid:     string;
  status:    'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?:   object[];
}

export function parseWebhookBody(body: Record<string, unknown>): {
  messages: IncomingMessage[];
  statuses: StatusUpdate[];
  phoneNumberId: string;
} {
  const result = { messages: [] as IncomingMessage[], statuses: [] as StatusUpdate[], phoneNumberId: '' };
  try {
    const entry     = (body.entry as Record<string, unknown>[])?.[0];
    const change    = (entry?.changes as Record<string, unknown>[])?.[0];
    const value     = change?.value as Record<string, unknown>;

    result.phoneNumberId = (value?.metadata as Record<string, unknown>)?.phone_number_id as string ?? '';

    // Inbound messages
    const msgs = (value?.messages as Record<string, unknown>[]) ?? [];
    for (const m of msgs) {
      const btn = m.button as Record<string, unknown> | undefined;
      result.messages.push({
        wamid:     m.id as string,
        from:      m.from as string,
        timestamp: m.timestamp as string,
        type:      m.type as string,
        text:      (m.text as Record<string, unknown>)?.body as string,
        image:     m.image as object,
        audio:     m.audio as object,
        document:  m.document as object,
        video:     m.video as object,
        interactive: m.interactive as object,
        button:    btn ? { text: btn.text as string, payload: btn.payload as string } : undefined,
      });
    }

    // Status updates
    const statuses = (value?.statuses as Record<string, unknown>[]) ?? [];
    for (const s of statuses) {
      result.statuses.push({
        wamid:     s.id as string,
        status:    s.status as StatusUpdate['status'],
        timestamp: s.timestamp as string,
        errors:    s.errors as object[],
      });
    }
  } catch {
    // If parsing fails return empty arrays — we still log raw payload
  }
  return result;
}
