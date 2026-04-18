/**
 * GET    /api/contacts/[id]
 * PUT    /api/contacts/[id]
 * DELETE /api/contacts/[id]
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = requireAuth(req);
    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM contacts WHERE id = ? AND workspace_id = ?',
      [params.id, payload.workspaceId]
    );
    if (rows.length === 0) return apiError('Not found', 404);
    return apiSuccess(rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Server error', 500);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const payload = requireAuth(req);
    const body = await req.json();
    const { name, email, city, source, status, tags, notes, opted_in, chat_status } = body;

    // Chat status transition (intervene / resolve / reopen)
    if (chat_status !== undefined) {
      const sets: string[] = ['chat_status = ?'];
      const vals: unknown[] = [chat_status];
      if (chat_status === 'intervened') {
        sets.push('intervened_by = ?');
        vals.push(payload.email);
      } else if (chat_status === 'open') {
        sets.push('intervened_by = NULL');
      }
      vals.push(params.id, payload.workspaceId);
      await execute(
        `UPDATE contacts SET ${sets.join(', ')} WHERE id = ? AND workspace_id = ?`, vals
      );
      return apiSuccess({ updated: true });
    }

    // Normal profile update
    await execute(
      `UPDATE contacts SET name=?, email=?, city=?, source=?, status=?, tags=?, notes=?, opted_in=?
       WHERE id = ? AND workspace_id = ?`,
      [name, email, city, source, status, JSON.stringify(tags || []), notes, opted_in ? 1 : 0, params.id, payload.workspaceId]
    );
    return apiSuccess({ updated: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Server error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = requireAuth(req);
    await execute(
      'DELETE FROM contacts WHERE id = ? AND workspace_id = ?',
      [params.id, payload.workspaceId]
    );
    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Server error', 500);
  }
}
