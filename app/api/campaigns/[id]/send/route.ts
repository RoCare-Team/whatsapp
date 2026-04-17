/**
 * POST /api/campaigns/[id]/send
 * API Campaign endpoint — send a single WhatsApp template message
 * to any phone number without pre-selecting contacts.
 *
 * Body: { phone: "919876543210", variables?: { "1": "John", "2": "Order#123" } }
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, execute, insert } from '@/lib/db';
import { apiSuccess, apiError, normalizePhone } from '@/lib/utils';
import { sendTemplateMessage } from '@/lib/whatsapp';
import { RowDataPacket } from 'mysql2';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload    = requireAuth(req);
    const campaignId = Number(params.id);

    if (!campaignId) return apiError('Invalid campaign ID', 400);

    // ── Load campaign + template ─────────────────────────────
    const rows = await query<RowDataPacket[]>(
      `SELECT c.*, t.name as template_name, t.language,
              w.access_token, w.phone_number_id
       FROM campaigns c
       JOIN templates t  ON t.id = c.template_id
       JOIN workspaces w ON w.id = c.workspace_id
       WHERE c.id = ? AND c.workspace_id = ? AND c.campaign_type = 'api'`,
      [campaignId, payload.workspaceId]
    );

    if (rows.length === 0) return apiError('API campaign not found', 404);

    const campaign = rows[0];

    const accessToken   = (campaign.access_token   as string) || process.env.WHATSAPP_ACCESS_TOKEN || '';
    const phoneNumberId = (campaign.phone_number_id as string) || process.env.PHONE_NUMBER_ID      || '';

    if (!accessToken || !phoneNumberId) return apiError('WhatsApp credentials not configured', 400);

    // ── Parse request body ───────────────────────────────────
    const { phone, variables } = await req.json() as {
      phone:      string;
      variables?: Record<string, string>;
    };

    if (!phone) return apiError('phone is required', 400);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return apiError('Invalid phone number', 400);

    // ── Upsert contact ───────────────────────────────────────
    const existing = await query<RowDataPacket[]>(
      'SELECT id FROM contacts WHERE workspace_id = ? AND phone = ? LIMIT 1',
      [payload.workspaceId, normalizedPhone]
    );
    let contactId: number;
    if (existing.length > 0) {
      contactId = existing[0].id as number;
    } else {
      contactId = await insert(
        'INSERT INTO contacts (workspace_id, phone, source, opted_in) VALUES (?, ?, ?, 1)',
        [payload.workspaceId, normalizedPhone, 'api_campaign']
      );
    }

    // ── Build template components ────────────────────────────
    const components: { type: string; parameters: { type: string; text: string }[] }[] = [];
    if (variables && Object.keys(variables).length > 0) {
      const sortedKeys = Object.keys(variables).sort((a, b) => Number(a) - Number(b));
      components.push({
        type: 'body',
        parameters: sortedKeys.map((k) => ({ type: 'text', text: variables[k] })),
      });
    }

    // ── Send via Meta API ────────────────────────────────────
    const result = await sendTemplateMessage(
      accessToken,
      phoneNumberId,
      normalizedPhone,
      campaign.template_name as string,
      (campaign.language as string) || 'en',
      components,
    );

    const wamid = (result?.messages as Record<string, unknown>[])?.[0]?.id as string | undefined;

    // Build display content: body_text with variables replaced, fallback to template name
    let displayContent = (campaign.body_text as string) || (campaign.template_name as string);
    if (variables && displayContent) {
      for (const [k, v] of Object.entries(variables)) {
        displayContent = displayContent.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      }
    }

    // ── Store message row (enables webhook delivery tracking) ─
    const msgId = await insert(
      `INSERT INTO messages
         (workspace_id, contact_id, wamid, direction, type, content, campaign_id, status, sent_at)
       VALUES (?, ?, ?, 'outbound', 'template', ?, ?, 'sent', NOW())`,
      [payload.workspaceId, contactId, wamid || null, displayContent, campaignId]
    );

    // ── Add campaign_contacts entry (enables contact list + status tracking) ─
    await insert(
      `INSERT INTO campaign_contacts (campaign_id, contact_id, message_id, status, sent_at)
       VALUES (?, ?, ?, 'sent', NOW())
       ON DUPLICATE KEY UPDATE message_id = VALUES(message_id), status = 'sent', sent_at = NOW()`,
      [campaignId, contactId, msgId]
    );

    // ── Update campaign counters ─────────────────────────────
    await execute(
      `UPDATE campaigns
       SET sent_count = sent_count + 1, total_contacts = total_contacts + 1
       WHERE id = ?`,
      [campaignId]
    );

    return apiSuccess({ sent: true, phone: normalizedPhone, wamid });

  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[campaign/send]', err);
    return apiError('Failed to send message', 500);
  }
}
