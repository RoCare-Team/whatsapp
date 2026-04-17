/**
 * lib/db.ts
 * MySQL connection pool using mysql2/promise
 * Uses connection pooling for production performance
 */
import mysql from 'mysql2/promise';

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               Number(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'whatsapp_saas',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    charset:            'utf8mb4',
    timezone:           'Z',                // store as UTC
  });
}

// Singleton pool to avoid exhausting connections in dev (HMR)
const pool: mysql.Pool = global._mysqlPool ?? createPool();
if (process.env.NODE_ENV !== 'production') global._mysqlPool = pool;

export default pool;

// ---- helper: run a query and return rows typed as T ----
export async function query<T = mysql.RowDataPacket[]>(
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

// ---- helper: run INSERT and return insertId ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insert(sql: string, params?: any[]): Promise<number> {
  const [result] = await pool.execute(sql, params);
  return (result as mysql.ResultSetHeader).insertId;
}

// ---- helper: run UPDATE/DELETE and return affectedRows ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function execute(sql: string, params?: any[]): Promise<number> {
  const [result] = await pool.execute(sql, params);
  return (result as mysql.ResultSetHeader).affectedRows;
}
