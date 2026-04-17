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

    // ── Per-status counts ───────────────────────────────────
    const statusCounts = await query<RowDataPacket[]>(
      `SELECT cc.status, COUNT(*) as cnt
       FROM campaign_contacts cc
       WHERE cc.campaign_id = ?
       GROUP BY cc.status`,
      [campaignId]
    );
    const counts: Record<string, number> = { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const row of statusCounts) counts[row.status as string] = Number(row.cnt);

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
    const whereStatus = status !== 'all' ? `AND cc.status = '${status}'` : '';
    const contacts = await query<RowDataPacket[]>(
      `SELECT cc.id, cc.status, cc.error, cc.sent_at,
              COALESCE(c.name, c.phone) as name, c.phone,
              m.wamid
       FROM campaign_contacts cc
       JOIN contacts c ON c.id = cc.contact_id
       LEFT JOIN messages m ON m.id = cc.message_id
       WHERE cc.campaign_id = ? ${whereStatus}
       ORDER BY cc.sent_at DESC, cc.id DESC
       LIMIT ? OFFSET ?`,
      [campaignId, limit, offset]
    );

    // Total for pagination
    const totalRows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM campaign_contacts cc WHERE cc.campaign_id = ? ${whereStatus}`,
      [campaignId]
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
