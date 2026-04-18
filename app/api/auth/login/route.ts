/**
 * POST /api/auth/login
 */
import { NextRequest } from 'next/server';
import { comparePassword, signToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return apiError('Email and password required');

    // Get user
    const users = await query<RowDataPacket[]>(
      'SELECT u.*, wm.workspace_id FROM users u LEFT JOIN workspace_members wm ON wm.user_id = u.id WHERE u.email = ? LIMIT 1',
      [email]
    );
    if (users.length === 0) return apiError('Invalid credentials', 401);

    const user = users[0];
    const valid = await comparePassword(password, user.password as string);
    if (!valid) return apiError('Invalid credentials', 401);
    if (!user.is_active) return apiError('Account disabled', 403);

    const token = signToken({
      userId:      user.id as number,
      email:       user.email as string,
      role:        user.role as string,
      workspaceId: user.workspace_id as number,
    });

    const response = apiSuccess({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      workspaceId: user.workspace_id,
    });
    response.cookies.set('token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    });
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[login]', msg);
    return apiError(
      process.env.NODE_ENV === 'development' ? msg : 'Internal server error',
      500
    );
  }
}
