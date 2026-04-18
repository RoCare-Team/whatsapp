/**
 * GET /api/campaigns/[id]
 * Returns campaign detail + paginated contact list with message status
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload    = requireAuth(req);
    const campaignId = Number(params.id);
    const url        = new URL(req.url);
    const status     = url.searchParams.get('status') || 'all';   // all|sent|delivered|read|failed|pending
    const page       = Number(url.searchParams.get('page') || 1);
    const limit      = Number(url.searchParams.get('limit') || 50);
    const offset     = (page - 1) * limit;

    // ── Campaign row ────────────────────────────────────────
    const camps = await query<RowDataPacket[]>(
      `SELECT c.*, t.name as template_name, t.language, t.body_text, t.buttons,
              t.header_type, t.header_content, t.footer_text
       FROM campaigns c
       JOIN templates t ON t.id = c.template_id
       WHERE c.id = ? AND c.workspace_id = ?`,
      [campaignId, payload.workspaceId]
    );
    if (camps.length === 0) return apiError('Campaign not found', 404);
    const campaign = camps[0];

    // ── Per-status counts (use campaigns table directly — always accurate) ──
    const counts: Record<string, number> = {
      sent:      Number(campaign.sent_count      || 0),
      delivered: Number(campaign.delivered_count || 0),
      read:      Number(campaign.read_count      || 0),
      failed:    Number(campaign.failed_count    || 0),
      pending:   Math.max(0, Number(campaign.total_contacts || 0) - Number(campaign.sent_count || 0) - Number(campaign.failed_count || 0)),
      replied:   0,
    };

    // ── Reply count (inbound messages from campaign contacts after campaign start) ──
    const replyRows = await query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT m.contact_id) as replied
       FROM messages m
       INNER JOIN campaign_contacts cc ON cc.contact_id = m.contact_id AND cc.campaign_id = ?
       WHERE m.direction = 'inbound'
         AND m.workspace_id = ?
         AND m.created_at >= (SELECT COALESCE(started_at, created_at) FROM campaigns WHERE id = ?)`,
      [campaignId, payload.workspaceId, campaignId]
    );
    counts.replied = Number(replyRows[0]?.replied || 0);

    // ── Daily messages chart (last 7 days) ──────────────────
    const daily = await query<RowDataPacket[]>(
      `SELECT DATE(m.sent_at) as date, COUNT(*) as sent
       FROM messages m
       WHERE m.campaign_id = ? AND m.sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(m.sent_at)
       ORDER BY date ASC`,
      [campaignId]
    );

    // ── Contact list ────────────────────────────────────────
    const isRepliedFilter = status === 'replied';
    const whereStatus     = !isRepliedFilter && status !== 'all'
      ? status === 'sent'
        ? `AND cc.status IN ('sent', 'delivered', 'read')`
        : `AND cc.status = '${status}'`
      : '';
    const repliedJoin     = `LEFT JOIN (
      SELECT DISTINCT m2.contact_id
      FROM messages m2
      INNER JOIN campaign_contacts cc2 ON cc2.contact_id = m2.contact_id AND cc2.campaign_id = ?
      WHERE m2.direction = 'inbound' AND m2.workspace_id = ?
        AND m2.created_at >= (SELECT COALESCE(started_at, created_at) FROM campaigns WHERE id = ?)
    ) replied_contacts ON replied_contacts.contact_id = cc.contact_id`;
    const repliedFilter   = isRepliedFilter ? 'AND replied_contacts.contact_id IS NOT NULL' : '';

    const contacts = await query<RowDataPacket[]>(
      `SELECT cc.id, cc.status, cc.error, cc.sent_at,
              COALESCE(c.name, c.phone) as name, c.phone,
              m.wamid,
              (replied_contacts.contact_id IS NOT NULL) as has_replied
       FROM campaign_contacts cc
       JOIN contacts c ON c.id = cc.contact_id
       LEFT JOIN messages m ON m.id = cc.message_id
       ${repliedJoin}
       WHERE cc.campaign_id = ? ${whereStatus} ${repliedFilter}
       ORDER BY cc.sent_at DESC, cc.id DESC
       LIMIT ? OFFSET ?`,
      [campaignId, payload.workspaceId, campaignId, campaignId, limit, offset]
    );

    // Total for pagination
    const totalRows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM campaign_contacts cc
       ${repliedJoin}
       WHERE cc.campaign_id = ? ${whereStatus} ${repliedFilter}`,
      [campaignId, payload.workspaceId, campaignId, campaignId]
    );
    const total = Number(totalRows[0]?.total || 0);

    return apiSuccess({
      campaign,
      counts,
      daily,
      contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[campaign detail]', err);
    return apiError('Server error', 500);
  }
}
