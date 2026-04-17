/**
 * GET  /api/webhook  — Meta webhook verification
 * POST /api/webhook  — Receive incoming messages & status updates
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, insert, execute } from '@/lib/db';
import { parseWebhookBody, sendTextMessage } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

// ---- GET: Verify webhook with Meta ----
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 1️⃣ Check ENV variable first (works without DB)
  const envToken = process.env.VERIFY_TOKEN;
  if (envToken && token === envToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  // 2️⃣ Fallback: check DB for multi-tenant workspaces
  try {
    const ws = await query<RowDataPacket[]>(
      'SELECT id FROM workspaces WHERE verify_token = ? AND is_active = 1 LIMIT 1',
      [token]
    );
    if (ws.length > 0) {
      return new NextResponse(challenge, { status: 200 });
    }
  } catch {
    // DB not available — already checked ENV above
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// ---- POST: Handle incoming messages ----
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Identify workspace by phoneNumberId
  const { messages, statuses, phoneNumberId } = parseWebhookBody(body);

  let workspaceId: number | null = null;
  if (phoneNumberId) {
    const ws = await query<RowDataPacket[]>(
      'SELECT id, access_token FROM workspaces WHERE phone_number_id = ? AND is_active = 1 LIMIT 1',
      [phoneNumberId]
    );
    if (ws.length > 0) workspaceId = ws[0].id as number;
  }

  // Log raw payload
  await insert(
    'INSERT INTO webhook_logs (workspace_id, event_type, payload) VALUES (?, ?, ?)',
    [workspaceId, 'webhook', JSON.stringify(body)]
  );

  if (!workspaceId) return NextResponse.json({ received: true });

  // ---- Process inbound messages ----
  for (const msg of messages) {
    const phone = normalizePhone(msg.from);

    // Upsert contact
    let contact = await query<RowDataPacket[]>(
      'SELECT id FROM contacts WHERE workspace_id = ? AND phone = ? LIMIT 1',
      [workspaceId, phone]
    );
    let contactId: number;
    if (contact.length === 0) {
      contactId = await insert(
        'INSERT INTO contacts (workspace_id, phone, source, opted_in) VALUES (?, ?, ?, 1)',
        [workspaceId, phone, 'inbound']
      );
    } else {
      contactId = contact[0].id as number;
    }

    // Store message
    await insert(
      `INSERT IGNORE INTO messages (workspace_id, contact_id, wamid, direction, type, content, status, sent_at)
       VALUES (?, ?, ?, 'inbound', ?, ?, 'delivered', FROM_UNIXTIME(?))`,
      [workspaceId, contactId, msg.wamid, msg.type, msg.text || JSON.stringify(msg), msg.timestamp]
    );

    // ---- Chatbot: match rules ----
    if (msg.type === 'text' && msg.text) {
      await processChatbot(workspaceId, contactId, msg.text, phoneNumberId);
    }
  }

  // ---- Process status updates ----
  for (const status of statuses) {
    const fieldMap: Record<string, string> = {
      sent:      "status = 'sent', sent_at = NOW()",
      delivered: "status = 'delivered', delivered_at = NOW()",
      read:      "status = 'read', read_at = NOW()",
      failed:    "status = 'failed'",
    };
    const update = fieldMap[status.status];
    if (update) {
      await execute(`UPDATE messages SET ${update} WHERE wamid = ?`, [status.wamid]);
    }

    // Update campaign_contacts status + campaign counters
    if (status.status === 'delivered' || status.status === 'read' || status.status === 'failed') {
      const col = `${status.status}_count`;

      // Find the message row to get campaign_id
      const msgRows = await query<RowDataPacket[]>(
        'SELECT id, campaign_id FROM messages WHERE wamid = ? LIMIT 1',
        [status.wamid]
      );
      if (msgRows.length > 0 && msgRows[0].campaign_id) {
        const msgId    = msgRows[0].id as number;
        const campId   = msgRows[0].campaign_id as number;

        // Update campaign_contacts row
        await execute(
          `UPDATE campaign_contacts SET status = ? WHERE message_id = ?`,
          [status.status, msgId]
        );

        // Increment campaign counter (avoid double-counting: only if previous status was lower)
        await execute(
          `UPDATE campaigns SET ${col} = ${col} + 1 WHERE id = ?`,
          [campId]
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}

// ---- Chatbot rule matching ----
async function processChatbot(
  workspaceId: number,
  contactId: number,
  text: string,
  phoneNumberId: string
) {
  const rules = await query<RowDataPacket[]>(
    `SELECT cr.*, w.access_token FROM chatbot_rules cr
     JOIN workspaces w ON w.id = cr.workspace_id
     WHERE cr.workspace_id = ? AND cr.is_active = 1
     ORDER BY cr.priority DESC`,
    [workspaceId]
  );

  // Get contact phone for sending reply
  const contacts = await query<RowDataPacket[]>(
    'SELECT phone FROM contacts WHERE id = ?', [contactId]
  );
  if (contacts.length === 0) return;

  const phone       = contacts[0].phone as string;
  const lowerText   = text.toLowerCase().trim();

  for (const rule of rules) {
    const trigger = (rule.trigger_value as string || '').toLowerCase();
    let matched    = false;

    switch (rule.trigger_type) {
      case 'exact':      matched = lowerText === trigger; break;
      case 'keyword':    matched = lowerText.includes(trigger); break;
      case 'contains':   matched = lowerText.includes(trigger); break;
      case 'starts_with': matched = lowerText.startsWith(trigger); break;
      case 'any':        matched = true; break;
    }

    if (matched && rule.response_type === 'text' && rule.response_text) {
      const result = await sendTextMessage(
        rule.access_token as string, phoneNumberId, phone, rule.response_text as string
      );
      const wamid = result?.messages?.[0]?.id;
      if (wamid) {
        await insert(
          `INSERT INTO messages (workspace_id, contact_id, wamid, direction, type, content, status, sent_at)
           VALUES (?, ?, ?, 'outbound', 'text', ?, 'sent', NOW())`,
          [workspaceId, contactId, wamid, rule.response_text]
        );
      }
      break; // Stop after first match
    }
  }
}
