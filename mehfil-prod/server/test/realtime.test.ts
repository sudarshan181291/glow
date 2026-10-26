import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { auth, giveCoins, makeDancers, makeTestEnv, signUp, type TestEnv } from './helpers.js';

let t: TestEnv;
let base: string;
beforeAll(async () => {
  t = await makeTestEnv();
  await t.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = t.app.server.address() as { port: number };
  base = `ws://127.0.0.1:${addr.port}`;
});
afterAll(async () => { await t.close(); });

function connect(token: string) {
  const ws = new WebSocket(`${base}/ws?token=${token}`);
  const msgs: { type: string; data: any }[] = [];
  ws.on('message', (m) => msgs.push(JSON.parse(m.toString())));
  const until = async (pred: (m: { type: string; data: any }) => boolean, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const f = msgs.find(pred); if (f) return f; await new Promise((r) => setTimeout(r, 25)); }
    throw new Error(`timeout; got ${msgs.map((m) => m.type).join(',')}`);
  };
  return { ws, msgs, until, open: new Promise((r) => ws.on('open', r)) };
}

describe('real-time', () => {
  it('sends a snapshot, then live stage, gift and chat events to every viewer', async () => {
    const [d] = await makeDancers(t, 1);
    const guest = (await t.app.inject({ method: 'POST', url: '/auth/guest' })).json();
    const viewer = connect(guest.access);
    await viewer.open;
    const snap = await viewer.until((m) => m.type === 'snapshot');
    expect(Array.isArray(snap.data.dancers)).toBe(true);

    await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(d.token), payload: { mode: 'available' } });
    const ev = await viewer.until((m) => m.type === 'dancer' && m.data.id === d.id && m.data.status === 'stage');
    expect(ev.data.slot).toBe(0);

    const u = await signUp(t, 'Gifter_1');
    await giveCoins(t, u.id, 100);
    const g = await t.app.inject({ method: 'POST', url: '/gifts', headers: auth(u.token), payload: { dancerId: d.id, giftId: 'heart', idemKey: 'gift-rt-0001' } });
    expect(g.statusCode, g.body).toBe(200);
    const gift = await viewer.until((m) => m.type === 'gift');
    expect(gift.data.from).toBe('Gifter_1');

    await t.app.inject({ method: 'POST', url: '/chat', headers: auth(u.token), payload: { text: 'Wah wah!' } });
    const chat = await viewer.until((m) => m.type === 'chat' && m.data.text === 'Wah wah!');
    expect(chat.data.user).toBe('Gifter_1');
    viewer.ws.close();
  });

  it('delivers private events only to the right user', async () => {
    await t.ctx.db.query(`UPDATE studios SET config = config || '{"minStage": 0}'`);
    const [d] = await makeDancers(t, 1);
    await t.app.inject({ method: 'POST', url: '/dancer/availability', headers: auth(d.token), payload: { mode: 'available' } });
    const dancerWs = connect(d.token);
    const other = await signUp(t);
    const otherWs = connect(other.token);
    await Promise.all([dancerWs.open, otherWs.open]);
    const cust = await signUp(t, 'Booker_1');
    await giveCoins(t, cust.id, 600);
    const b = await t.app.inject({ method: 'POST', url: '/bookings', headers: auth(cust.token), payload: { dancerId: d.id, minutes: 5 } });
    expect(b.statusCode, b.body).toBe(200);
    const inc = await dancerWs.until((m) => m.type === 'incoming_request');
    expect(inc.data.customer).toBe('Booker_1');
    await new Promise((r) => setTimeout(r, 200));
    expect(otherWs.msgs.some((m) => m.type === 'incoming_request')).toBe(false);
    const accept = await t.app.inject({ method: 'POST', url: `/dancer/bookings/${b.json().id}/accept`, headers: auth(d.token) });
    expect(accept.statusCode, accept.body).toBe(200);
    const rooms = await otherWs.until((m) => m.type === 'rooms' && m.data.length > 0);
    expect(JSON.stringify(rooms.data)).not.toContain(cust.id); // customer identity never broadcast
    dancerWs.ws.close(); otherWs.ws.close();
  });

  it('rejects a bad token', async () => {
    const c = connect('not-a-token');
    const code = await new Promise((r) => c.ws.on('close', (c2) => r(c2)));
    expect(code).toBe(4401);
  });
});
