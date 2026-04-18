import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  console.error('[pool] idle client error', err.message);
});

export const db = drizzle(pool, { schema });
export { pool };

export async function withTransaction<T>(
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}
