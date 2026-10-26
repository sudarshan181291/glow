import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../src/config.js';
import type { Ctx } from '../src/ctx.js';
import { buildApp, makeFastify } from '../src/app.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { Tokens } from '../src/lib/auth.js';
import { ConsoleOtp } from '../src/services/otp.js';
import { NoopPush } from '../src/services/push.js';
import { Realtime } from '../src/services/realtime.js';
import { LiveKitVideo } from '../src/services/video.js';
import { tick } from '../src/services/engine.js';

/** LiveKit with real token signing but no network calls. */
export class FakeVideo extends LiveKitVideo {
  created: string[] = [];
  deleted: string[] = [];
  constructor() { super('wss://test.livekit.cloud', 'testkey', 'testsecret-testsecret-testsecret-testsecret'); }
  async createRoom(room: string) { this.created.push(room); }
  async deleteRoom(room: string) { this.deleted.push(room); }
  async removeParticipant() {}
}

export interface TestEnv {
  ctx: Ctx; app: FastifyInstance; video: FakeVideo; push: NoopPush;
  clock: { offsetMs: number };
  close(): Promise<void>;
  tick(): Promise<void>;
}

export async function makeTestEnv(extra: Partial<Ctx> = {}): Promise<TestEnv> {
  const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_ADMIN_URL });
  await admin.connect();
  const name = `t_${randomBytes(5).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = process.env.TEST_DATABASE_ADMIN_URL!.replace(/\/[^/]*$/, `/${name}`);
  const env = loadEnv({
    NODE_ENV: 'test', DATABASE_URL: url, JWT_SECRET: 'x'.repeat(40), OTP_PEPPER: 'pepper-pepper-pepper', DEV_FIXED_OTP: '123456', ENGINE_TICK_MS: '100000', RATE_LIMIT_ALLOWLIST: '127.0.0.1',
  } as never);
  const app = makeFastify('silent');
  const db = createPool(url);
  await migrate(db);
  await seed(db);
  const video = new FakeVideo();
  const push = new NoopPush();
  const clock = { offsetMs: 0 };
  const ctx: Ctx = {
    env, db, log: app.log, rt: new Realtime(db, app.log), video, otp: new ConsoleOtp(app.log), push,
    tokens: new Tokens(env.JWT_SECRET), now: () => new Date(Date.now() + clock.offsetMs), ...extra,
  };
  await ctx.rt.start();
  await buildApp(ctx, app);
  await app.ready();
  return {
    ctx, app, video, push, clock,
    tick: () => tick(ctx),
    async close() { await app.close(); await ctx.rt.stop(); await db.end(); },
  };
}

let phoneSeq = 0;
export function newPhone() { phoneSeq += 1; return `9${String(Date.now() % 1e5).padStart(5, '0')}${String(phoneSeq).padStart(4, '0')}`; }

/** Sign up a customer through the real OTP flow. */
export async function signUp(t: TestEnv, name?: string) {
  const phone = newPhone();
  await t.app.inject({ method: 'POST', url: '/auth/otp/request', payload: { phone } });
  const r = await t.app.inject({
    method: 'POST', url: '/auth/otp/verify',
    payload: { phone, code: '123456', displayName: name ?? `user_${phone.slice(-6)}`, dob: '1995-05-05', ageConfirmed: true },
  });
  if (r.statusCode !== 200) throw new Error(`signUp failed: ${r.body}`);
  const body = r.json();
  return { phone, id: body.user.id as string, token: body.access as string, refresh: body.refresh as string };
}

export async function giveCoins(t: TestEnv, userId: string, coins: number) {
  const { withTx } = await import('../src/db/pool.js');
  const { applyLedger } = await import('../src/services/ledger.js');
  await withTx(t.ctx.db, (tx) => applyLedger(tx, userId, coins, 'adjust', { idemKey: `test-${randomBytes(6).toString('hex')}` }));
}

/** Create N KYC-approved dancers and return their auth. */
export async function makeDancers(t: TestEnv, n: number) {
  const studio = (await t.ctx.db.query('SELECT id FROM studios LIMIT 1')).rows[0].id;
  const out: { id: string; token: string; name: string }[] = [];
  for (let i = 0; i < n; i++) {
    const phone = `+91${newPhone()}`;
    const name = `Dancer${i}_${phone.slice(-4)}`;
    const u = (await t.ctx.db.query(`INSERT INTO users(phone, display_name, role, dob, age_confirmed_at) VALUES ($1,$2,'dancer','1998-01-01',now()) RETURNING id`, [phone, name])).rows[0];
    await t.ctx.db.query('INSERT INTO wallets(user_id) VALUES ($1)', [u.id]);
    await t.ctx.db.query(`INSERT INTO dancers(user_id, studio_id, stage_name, kyc_status, split_pct) VALUES ($1,$2,$3,'approved',50)`, [u.id, studio, name]);
    out.push({ id: u.id, token: await t.ctx.tokens.access(u.id, 'dancer'), name });
  }
  return out;
}

export async function staffToken(t: TestEnv, role: 'floor' | 'moderator' | 'admin') {
  const phone = `+91${newPhone()}`;
  const u = (await t.ctx.db.query(`INSERT INTO users(phone, display_name, role, age_confirmed_at) VALUES ($1,$2,$3,now()) RETURNING id`, [phone, `${role}_${phone.slice(-5)}`, role])).rows[0];
  return { id: u.id as string, token: await t.ctx.tokens.access(u.id, role) };
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });
export async function status(t: TestEnv, id: string) {
  return (await t.ctx.db.query('SELECT status, slot FROM dancers WHERE user_id=$1', [id])).rows[0];
}
export async function balance(t: TestEnv, id: string) {
  return (await t.ctx.db.query('SELECT balance FROM wallets WHERE user_id=$1', [id])).rows[0]?.balance ?? 0;
}
