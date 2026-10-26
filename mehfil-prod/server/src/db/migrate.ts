import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Apply every .sql file in migrations/ that has not run yet, in name order. */
export async function migrate(db: Db, dir = join(here, 'migrations')): Promise<string[]> {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
      await c.query('COMMIT');
      applied.push(f);
    } catch (e) {
      await c.query('ROLLBACK');
      throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
    } finally {
      c.release();
    }
  }
  return applied;
}

// CLI: npm run migrate
if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  const { createPool } = await import('./pool.js');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const db = createPool(url);
  const applied = await migrate(db);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date');
  await db.end();
}
