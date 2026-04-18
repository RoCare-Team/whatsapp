import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    // Test env vars
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;
    const missing: string[] = [];
    for (const key of requiredVars) {
      if (!process.env[key]) missing.push(key);
    }

    if (missing.length > 0) {
      return apiError(`Missing env vars: ${missing.join(', ')}`, 500);
    }

    // Test pool connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    // Test simple query
    const [rows] = await pool.execute('SELECT 1 as ping');
    
    const tablesResult = await pool.execute('SHOW TABLES LIKE ?',['users'] );
    
    return apiSuccess({
      status: 'OK',
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      ping: rows,
      hasUsersTable: (tablesResult[0] as any[]).length > 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[db/test]', msg);
    return apiError(process.env.NODE_ENV === 'development' ? msg : 'DB connection failed', 500);
  }
}

