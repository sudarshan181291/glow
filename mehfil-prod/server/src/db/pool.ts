import pg from 'pg';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;
export type Queryable = pg.Pool | pg.PoolClient;

// Return BIGINT columns as JS numbers (coin amounts stay far below 2^53).
pg.types.setTypeParser(20, (v) => Number(v));

export function createPool(url: string): Db {
  return new pg.Pool({ connectionString: url, max: 20, idleTimeoutMillis: 30000 });
}

/** Run fn inside a transaction; rolls back on any error. */
export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query('BEGIN');
    const out = await fn(tx);
    await tx.query('COMMIT');
    return out;
  } catch (e) {
    await tx.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    tx.release();
  }
}
