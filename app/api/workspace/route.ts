/**
 * GET /api/workspace  — get workspace settings
 * PUT /api/workspace  — update workspace settings
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const rows = await query<RowDataPacket[]>(
      'SELECT id, name, phone_number_id, waba_id, verify_token, plan, is_active FROM workspaces WHERE id = ?',
      [payload.workspaceId]
    );
    if (rows.length === 0) return apiError('Workspace not found', 404);
    return apiSuccess(rows[0]);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Server error', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    if (payload.role !== 'admin') return apiError('Admin only', 403);

    const { name, phone_number_id, waba_id, access_token } = await req.json();

    await execute(
      `UPDATE workspaces SET name=?, phone_number_id=?, waba_id=?, access_token=?
       WHERE id = ?`,
      [name, phone_number_id, waba_id, access_token, payload.workspaceId]
    );
    return apiSuccess({ updated: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Server error', 500);
  }
}
