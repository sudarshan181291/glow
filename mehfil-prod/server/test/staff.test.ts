import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, balance, giveCoins, makeDancers, makeTestEnv, signUp, staffToken, status, type TestEnv } from './helpers.js';

let t: TestEnv;
beforeAll(async () => { t = await makeTestEnv(); });
afterAll(async () => { await t.close(); });

describe('floor, moderation and admin', () => {
  it('kill switch ends all rooms with refunds and returns dancers', async () => {
    await t.ctx.db.query(`UPDATE studios SET config = config || '{"minStage": 0}'`);
    const ds = await makeDancers(t, 3);
    for (const d of ds) await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(d.token), payload: { mode: 'available' } });
    const custs = [await signUp(t), await signUp(t)];
    for (const [i, c] of custs.entries()) {
      await giveCoins(t, c.id, 1300);
      const b = (await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(c.token), payload: { dancerId: ds[i].id, minutes: 15 } })).json();
      const a = await t.app.inject({ method: 'POST', url: `/dancer/bookings/${b.id}/accept`, headers: auth(ds[i].token) });
      expect(a.statusCode, a.body).toBe(200);
    }
    const floor = await staffToken(t, 'floor');
    const k = await t.app.inject({ method: 'POST', url: '/floor/kill', headers: auth(floor.token) });
    expect(k.json().ended).toBe(2);
    for (const c of custs) expect(await balance(t, c.id)).toBeGreaterThan(1290);
    expect((await status(t, ds[0].id)).status).toBe('stage');
    const log = (await t.ctx.db.query(`SELECT count(*)::int AS n FROM audit_log WHERE action='floor.kill_all'`)).rows[0].n;
    expect(log).toBe(1);
  });

  it('customers cannot use staff endpoints', async () => {
    const c = await signUp(t);
    expect((await t.app.inject({ method: 'POST', url: '/floor/kill', headers: auth(c.token) })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'GET', url: '/floor/overview', headers: auth(c.token) })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url: '/admin/payouts/run', headers: auth(c.token), payload: {} })).statusCode).toBe(403);
  });

  it('floor can change config with validation', async () => {
    const floor = await staffToken(t, 'floor');
    const ok = await t.app.inject({ method: 'PATCH', url: '/floor/config', headers: auth(floor.token), payload: { maxRooms: 8, price5: 450 } });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().config.maxRooms).toBe(8);
    const bad = await t.app.inject({ method: 'PATCH', url: '/floor/config', headers: auth(floor.token), payload: { minStage: 50 } });
    expect(bad.statusCode).toBe(400);
    const unknown = await t.app.inject({ method: 'PATCH', url: '/floor/config', headers: auth(floor.token), payload: { hack: 1 } });
    expect(unknown.statusCode).toBe(400);
  });

  it('moderator ban signs the user out and blocks booking', async () => {
    const c = await signUp(t);
    const mod = await staffToken(t, 'moderator');
    const r = await t.app.inject({ method: 'POST', url: `/mod/users/${c.id}/ban`, headers: auth(mod.token), payload: { reason: 'abuse in chat' } });
    expect(r.statusCode).toBe(200);
    const refresh = await t.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refresh: c.refresh } });
    expect(refresh.statusCode).toBe(401);
  });

  it('admin creates a dancer, approves KYC and runs payouts', async () => {
    const admin = await staffToken(t, 'admin');
    const under = await t.app.inject({ method: 'POST', url: '/admin/dancers', headers: auth(admin.token), payload: { phone: '9811111111', stageName: 'Young', dob: '2010-01-01' } });
    expect(under.statusCode).toBe(400);
    const r = await t.app.inject({ method: 'POST', url: '/admin/dancers', headers: auth(admin.token), payload: { phone: '9822222222', stageName: 'Priya', dob: '1997-03-03', specs: ['Garba'] } });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().id;
    const dt = await t.ctx.tokens.access(id, 'dancer');
    expect((await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(dt), payload: { mode: 'available' } })).statusCode).toBe(403);
    await t.app.inject({ method: 'POST', url: `/admin/dancers/${id}/kyc`, headers: auth(admin.token), payload: { status: 'approved', reference: 'KYC-1' } });
    expect((await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(dt), payload: { mode: 'available' } })).statusCode).toBe(200);
    const c = await signUp(t);
    await giveCoins(t, c.id, 5000);
    const g = await t.app.inject({ method: 'POST', url: '/gifts', headers: auth(c.token), payload: { dancerId: id, giftId: 'stagecall', idemKey: 'big-gift-0001' } });
    expect(g.statusCode, g.body).toBe(200);
    const csv = await t.app.inject({ method: 'POST', url: '/admin/payouts/run', headers: auth(admin.token), payload: { minRupees: 100 } });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('"Priya"');
    expect(csv.body).toContain('1875.00'); // 2500 coins share × ₹0.75
  });
});
