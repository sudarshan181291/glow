// Starts a real PostgreSQL (embedded) for the test run.
import EmbeddedPostgres from 'embedded-postgres';
import { mkdirSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';

let pg: EmbeddedPostgres | undefined;

export async function setup() {
  if (process.env.TEST_DATABASE_ADMIN_URL) return; // use an external PostgreSQL (e.g. in CI)
  const base = join(process.cwd(), '.pgtest');
  mkdirSync(base, { recursive: true });
  chmodSync(base, 0o777);
  const dir = join(base, `data-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: 54331, persistent: false, onLog: () => {} });
  await pg.initialise();
  await pg.start();
  process.env.TEST_DATABASE_ADMIN_URL = 'postgres://postgres:postgres@127.0.0.1:54331/postgres';
}

export async function teardown() {
  if (pg) await pg.stop();
}
