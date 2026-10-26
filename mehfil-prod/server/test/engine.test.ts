import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import { auth, balance, giveCoins, makeDancers, makeTestEnv, signUp, status, type TestEnv } from './helpers.js';

let t: TestEnv;
let dancers: Awaited<ReturnType<typeof makeDancers>>;

beforeAll(async () => {
  t = await makeTestEnv();
  dancers = await makeDancers(t, 20);
  for (const d of dancers) {
    const r = await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(d.token), payload: { mode: 'available' } });
    expect(r.statusCode).toBe(200);
  }
});
afterAll(async () => { await t.close(); });
beforeEach(() => { t.clock.offsetMs = 0; });

const counts = async () => {
  const r = await t.ctx.db.query(`SELECT status, count(*)::int AS n FROM dancers GROUP BY status`);
  return Object.fromEntries(r.rows.map((x) => [x.status, x.n])) as Record<string, number>;
};

async function bookAndAccept(customer: { token: string }, dancer: { id: string; token: string }, minutes = 5) {
  const b = await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(customer.token), payload: { dancerId: dancer.id, minutes } });
  expect(b.statusCode, b.body).toBe(200);
  const id = b.json().id;
  const a = await t.app.inject({ method: 'POST', url: `/dancer/bookings/${id}/accept`, headers: auth(dancer.token) });
  expect(a.statusCode, a.body).toBe(200);
  return id as string;
}

describe('stage and movement engine', () => {
  it('fills 16 stage slots and benches the rest', async () => {
    const c = await counts();
    expect(c.stage).toBe(16);
    expect(c.bench).toBe(4);
    const slots = (await t.ctx.db.query(`SELECT slot FROM dancers WHERE status='stage' ORDER BY slot`)).rows.map((r) => r.slot);
    expect(slots).toEqual([...Array(16).keys()]);
  });

  it('accepting a booking charges the customer, moves her off stage and backfills', async () => {
    const cust = await signUp(t);
    await giveCoins(t, cust.id, 2000);
    const onStage = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 1`)).rows[0].user_id;
    const dancer = dancers.find((d) => d.id === onStage)!;
    const id = await bookAndAccept(cust, dancer);
    expect(await balance(t, cust.id)).toBe(1500);
    expect((await status(t, dancer.id)).status).toBe('private');
    expect((await counts()).stage).toBe(15);
    expect(t.video.created).toContain(`room-${id}`);

    t.clock.offsetMs = 2000; // bench dancer has waited past the backfill delay
    await t.tick();
    expect((await counts()).stage).toBe(16);

    const tok = await t.app.inject({ method: 'GET', url: `/bookings/${id}/token`, headers: auth(cust.token) });
    expect(tok.statusCode).toBe(200);
    const claims = decodeJwt(tok.json().token) as { video: { room: string; canPublish: boolean } };
    expect(claims.video.room).toBe(`room-${id}`);
    expect(claims.video.canPublish).toBe(true);

    // time runs out → she returns (stage is full, so the bench)
    t.clock.offsetMs = 6 * 60000;
    await t.tick();
    expect((await t.ctx.db.query('SELECT status FROM bookings WHERE id=$1', [id])).rows[0].status).toBe('ended');
    expect(['stage', 'bench']).toContain((await status(t, dancer.id)).status);
    expect(t.video.deleted).toContain(`room-${id}`);
    const earned = (await t.ctx.db.query(`SELECT sum(dancer_share)::int AS s FROM earnings WHERE ref_id=$1`, [id])).rows[0].s;
    expect(earned).toBe(250);
  });

  it('refunds pro-rata when the dancer ends early', async () => {
    const cust = await signUp(t);
    await giveCoins(t, cust.id, 1300);
    const free = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 1`)).rows[0].user_id;
    const dancer = dancers.find((x) => x.id === free)!;
    const id = await bookAndAccept(cust, dancer, 15);
    expect(await balance(t, cust.id)).toBe(0);
    t.clock.offsetMs = 5 * 60000; // a third of the way in
    const r = await t.app.inject({ method: 'POST', url: `/bookings/${id}/end`, headers: auth(dancer.token) });
    expect(r.statusCode).toBe(200);
    expect(r.json().refund).toBeGreaterThanOrEqual(860);
    expect(r.json().refund).toBeLessThanOrEqual(870);
    expect(await balance(t, cust.id)).toBe(r.json().refund);
  });

  it('no refund when the customer leaves', async () => {
    const cust = await signUp(t);
    await giveCoins(t, cust.id, 500);
    const free = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 1`)).rows[0].user_id;
    const dancer = dancers.find((x) => x.id === free)!;
    const id = await bookAndAccept(cust, dancer);
    const r = await t.app.inject({ method: 'POST', url: `/bookings/${id}/end`, headers: auth(cust.token) });
    expect(r.json().refund).toBe(0);
    expect(await balance(t, cust.id)).toBe(0);
  });

  it('declined and expired requests take no coins', async () => {
    const cust = await signUp(t);
    await giveCoins(t, cust.id, 600);
    const free = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 1`)).rows[0].user_id;
    const dancer = dancers.find((x) => x.id === free)!;
    const b = (await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(cust.token), payload: { dancerId: dancer.id, minutes: 5 } })).json();
    const dec = await t.app.inject({ method: 'POST', url: `/dancer/bookings/${b.id}/decline`, headers: auth(dancer.token) });
    expect(dec.json().status).toBe('declined');
    const b2 = (await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(cust.token), payload: { dancerId: dancer.id, minutes: 5 } })).json();
    t.clock.offsetMs = 30000;
    await t.tick();
    expect((await t.ctx.db.query('SELECT status FROM bookings WHERE id=$1', [b2.id])).rows[0].status).toBe('expired');
    const late = await t.app.inject({ method: 'POST', url: `/dancer/bookings/${b2.id}/accept`, headers: auth(dancer.token) });
    expect(late.statusCode).toBe(409);
    expect(await balance(t, cust.id)).toBe(600);
  });

  it('refuses a booking without enough coins and blocks a second open booking', async () => {
    const cust = await signUp(t);
    const free = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 2`)).rows.map((r) => r.user_id);
    const r = await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(cust.token), payload: { dancerId: free[0], minutes: 5 } });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe('insufficient_coins');
    await giveCoins(t, cust.id, 2000);
    expect((await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(cust.token), payload: { dancerId: free[0], minutes: 5 } })).statusCode).toBe(200);
    const second = await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(cust.token), payload: { dancerId: free[1], minutes: 5 } });
    expect(second.json().error).toBe('open_booking');
  });

  it('enforces the room cap with a waitlist that VIPs jump', async () => {
    await t.ctx.db.query(`UPDATE bookings SET status='cancelled' WHERE status IN ('requested','waitlisted')`);
    const studio = (await t.ctx.db.query('SELECT id, config FROM studios LIMIT 1')).rows[0];
    await t.ctx.db.query('UPDATE studios SET config = config || $2 WHERE id=$1', [studio.id, JSON.stringify({ maxRooms: 1 })]);
    await t.ctx.db.query(`UPDATE bookings SET status='ended' WHERE status='active'`);
    await t.ctx.db.query(`UPDATE dancers SET status='bench', slot=NULL WHERE status='private'`);
    t.clock.offsetMs = 10000; await t.tick();

    const stageIds = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 3`)).rows.map((r) => r.user_id);
    const [a, b, c] = [await signUp(t), await signUp(t), await signUp(t)];
    for (const u of [a, b, c]) await giveCoins(t, u.id, 1000);
    await t.ctx.db.query(`UPDATE users SET vip_until = now() + interval '30 days' WHERE id=$1`, [c.id]);
    await bookAndAccept(a, dancers.find((d) => d.id === stageIds[0])!);
    const wb = (await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(b.token), payload: { dancerId: stageIds[1], minutes: 5 } })).json();
    const wc = (await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(c.token), payload: { dancerId: stageIds[2], minutes: 5 } })).json();
    expect(wb.status).toBe('waitlisted');
    expect(wc.status).toBe('waitlisted');
    t.clock.offsetMs = 10 * 60000; // a's room ends
    await t.tick();
    const st = async (id: string) => (await t.ctx.db.query('SELECT status FROM bookings WHERE id=$1', [id])).rows[0].status;
    expect(await st(wc.id)).toBe('requested'); // VIP first
    expect(await st(wb.id)).toBe('waitlisted');
    await t.ctx.db.query('UPDATE studios SET config = config || $2 WHERE id=$1', [studio.id, JSON.stringify({ maxRooms: 6 })]);
  });

  it('keeps the stage at its minimum', async () => {
    await t.ctx.db.query(`UPDATE bookings SET status='cancelled' WHERE status IN ('requested','waitlisted')`);
    // empty the bench and shrink the stage to exactly the minimum
    const studio = (await t.ctx.db.query('SELECT id FROM studios LIMIT 1')).rows[0];
    await t.ctx.db.query('UPDATE studios SET config = config || $2 WHERE id=$1', [studio.id, JSON.stringify({ minStage: 16 })]);
    await t.ctx.db.query(`UPDATE dancers SET status='off' WHERE status='bench'`);
    const st = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 1`)).rows[0].user_id;
    const n = (await t.ctx.db.query(`SELECT count(*)::int AS n FROM dancers WHERE status='stage'`)).rows[0].n;
    const cust = await signUp(t);
    await giveCoins(t, cust.id, 1000);
    const b = (await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(cust.token), payload: { dancerId: st, minutes: 5 } })).json();
    const a = await t.app.inject({ method: 'POST', url: `/dancer/bookings/${b.id}/accept`, headers: auth(dancers.find((d) => d.id === st)!.token) });
    if (n <= 16) expect(a.json().error).toBe('stage_minimum');
    await t.ctx.db.query('UPDATE studios SET config = config || $2 WHERE id=$1', [studio.id, JSON.stringify({ minStage: 12 })]);
  });

  it('refunds song requests when she leaves the stage', async () => {
    await t.ctx.db.query(`UPDATE bookings SET status='cancelled' WHERE status IN ('requested','waitlisted')`);
    const cust = await signUp(t);
    await giveCoins(t, cust.id, 1000);
    const st = (await t.ctx.db.query(`SELECT user_id FROM dancers WHERE status='stage' LIMIT 1`)).rows[0].user_id;
    const s = await t.app.inject({ method: 'POST', url: '/songs/request', headers: auth(cust.token), payload: { dancerId: st, songId: 's2', idemKey: 'song-req-1' } });
    expect(s.statusCode, s.body).toBe(200);
    expect(await balance(t, cust.id)).toBe(800);
    await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(dancers.find((d) => d.id === st)!.token), payload: { mode: 'break' } });
    expect(await balance(t, cust.id)).toBe(1000);
  });

  it('only KYC-approved dancers can go live', async () => {
    const [d] = await makeDancers(t, 1);
    await t.ctx.db.query(`UPDATE dancers SET kyc_status='pending' WHERE user_id=$1`, [d.id]);
    const r = await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(d.token), payload: { mode: 'available' } });
    expect(r.statusCode).toBe(403);
  });
});
