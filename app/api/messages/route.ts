/**
 * GET /api/messages?contactId=X
 * Returns conversation history with a contact
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const sp        = new URL(req.url).searchParams;
    const contactId = sp.get('contactId');
    const limit     = Math.min(100, Number(sp.get('limit') || 50));

    if (!contactId) return apiError('contactId required');

    const messages = await query<RowDataPacket[]>(
      `SELECT m.*, c.name as contact_name, c.phone as contact_phone
       FROM messages m
       LEFT JOIN contacts c ON c.id = m.contact_id
       WHERE m.workspace_id = ? AND m.contact_id = ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [payload.workspaceId, contactId, limit]
    );

    return apiSuccess(messages.reverse()); // oldest first
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Server error', 500);
  }
}
