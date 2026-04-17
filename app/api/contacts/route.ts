/**
 * GET  /api/contacts  — list contacts (paginated, filterable)
 * POST /api/contacts  — create contact
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, insert } from '@/lib/db';
import { apiSuccess, apiError, getPagination, normalizePhone } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const sp      = new URL(req.url).searchParams;
    const { limit, offset, page } = getPagination(sp);
    const search  = sp.get('search') || '';
    const status  = sp.get('status') || '';

    let sql    = `
      SELECT c.*,
        (SELECT COUNT(*) FROM messages m
         WHERE m.contact_id = c.id AND m.direction = 'inbound'
           AND m.created_at > COALESCE(
             (SELECT MAX(m2.created_at) FROM messages m2
              WHERE m2.contact_id = c.id AND m2.direction = 'outbound'),
             '1970-01-01'
           )
        ) AS unread_count,
        (SELECT MAX(m3.created_at) FROM messages m3 WHERE m3.contact_id = c.id) AS last_message_at
      FROM contacts c WHERE c.workspace_id = ?`;
    let countSql = 'SELECT COUNT(*) as total FROM contacts WHERE workspace_id = ?';
    const params: unknown[] = [payload.workspaceId];

    if (search) {
      sql       += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      countSql  += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      sql      += ' AND c.status = ?';
      countSql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY last_message_at DESC, c.created_at DESC LIMIT ? OFFSET ?';
    const listParams  = [...params, limit, offset];
    const countParams = params;

    const [contacts, countResult] = await Promise.all([
      query<RowDataPacket[]>(sql, listParams),
      query<RowDataPacket[]>(countSql, countParams),
    ]);

    const total = (countResult[0] as RowDataPacket).total as number;

    return apiSuccess({
      data:       contacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[contacts GET]', err);
    return apiError('Server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const { name, phone, email, city, source, status, tags, notes } = await req.json();

    if (!phone) return apiError('Phone number is required');
    const normalizedPhone = normalizePhone(phone);

    // Check duplicate
    const existing = await query<RowDataPacket[]>(
      'SELECT id FROM contacts WHERE workspace_id = ? AND phone = ?',
      [payload.workspaceId, normalizedPhone]
    );
    if (existing.length > 0) return apiError('Contact with this phone already exists', 409);

    const id = await insert(
      `INSERT INTO contacts (workspace_id, name, phone, email, city, source, status, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.workspaceId,
        name || null, normalizedPhone,
        email || null, city || null, source || 'manual',
        status || 'new',
        JSON.stringify(tags || []),
        notes || null,
      ]
    );

    return apiSuccess({ id }, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[contacts POST]', err);
    return apiError('Server error', 500);
  }
}
