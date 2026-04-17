/**
 * POST /api/send-message
 * Send a text or template message to a contact
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, insert } from '@/lib/db';
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp';
import { apiSuccess, apiError, normalizePhone } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const body = await req.json();
    const { contactId, type, text, templateName, language, components } = body;

    if (!contactId) return apiError('contactId is required');

    // Get workspace config
    const ws = await query<RowDataPacket[]>(
      'SELECT access_token, phone_number_id FROM workspaces WHERE id = ? AND is_active = 1',
      [payload.workspaceId]
    );
    if (ws.length === 0) return apiError('Workspace not configured', 400);
    const { access_token, phone_number_id } = ws[0];

    if (!access_token || !phone_number_id) {
      return apiError('WhatsApp API not configured in workspace settings', 400);
    }

    // Get contact phone
    const contacts = await query<RowDataPacket[]>(
      'SELECT phone FROM contacts WHERE id = ? AND workspace_id = ?',
      [contactId, payload.workspaceId]
    );
    if (contacts.length === 0) return apiError('Contact not found', 404);
    const phone = normalizePhone(contacts[0].phone as string);

    let result: Record<string, unknown>;
    let content: string;
    let msgType: string;

    if (type === 'template') {
      if (!templateName) return apiError('templateName required for template messages');
      result  = await sendTemplateMessage(access_token as string, phone_number_id as string, phone, templateName, language || 'en', components || []);
      content = JSON.stringify({ templateName, components });
      msgType = 'template';
    } else {
      if (!text) return apiError('text required');
      result  = await sendTextMessage(access_token as string, phone_number_id as string, phone, text);
      content = text;
      msgType = 'text';
    }

    const wamid = (result?.messages as Record<string, unknown>[])?.[0]?.id as string;

    // Store in DB
    const msgId = await insert(
      `INSERT INTO messages (workspace_id, contact_id, wamid, direction, type, content, status, sent_at)
       VALUES (?, ?, ?, 'outbound', ?, ?, 'sent', NOW())`,
      [payload.workspaceId, contactId, wamid, msgType, content]
    );

    return apiSuccess({ messageId: msgId, wamid });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[send-message]', err);
    return apiError('Failed to send message', 500);
  }
}
