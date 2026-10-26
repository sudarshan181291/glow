import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hmacHex } from '../src/lib/crypto.js';
import { Razorpay } from '../src/services/payments/razorpay.js';
import type { PlayVerifier } from '../src/services/payments/play.js';
import { auth, balance, makeTestEnv, signUp, type TestEnv } from './helpers.js';

const KEY_SECRET = 'rzp_secret_test_123';
const HOOK_SECRET = 'rzp_webhook_secret_456';
class FakeRazorpay extends Razorpay {
  orders = 0;
  constructor() { super('rzp_test_key', KEY_SECRET, HOOK_SECRET); }
  async createOrder(amount: number) { this.orders += 1; return { id: `order_${this.orders}_${Date.now()}`, amount, currency: 'INR' }; }
}
class FakePlay implements PlayVerifier {
  consumed: string[] = [];
  async getProduct(_p: string, token: string) { return { purchaseState: token.startsWith('bad') ? 1 : 0, orderId: `GPA.${token}` }; }
  async consumeProduct(_p: string, token: string) { this.consumed.push(token); }
  async getSubscription() { return { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'vip_monthly', expiryTime: new Date(Date.now() + 30 * 864e5).toISOString() }], latestOrderId: 'GPA.sub1' }; }
  async acknowledgeSubscription() {}
}

let t: TestEnv;
const play = new FakePlay();
beforeAll(async () => { t = await makeTestEnv({ razorpay: new FakeRazorpay(), play }); });
afterAll(async () => { await t.close(); });

describe('Razorpay', () => {
  it('credits coins plus the first-purchase bonus once, verified by signature', async () => {
    const u = await signUp(t);
    const o = await t.app.inject({ method: 'POST', url: '/payments/razorpay/order', headers: auth(u.token), payload: { productId: 'coins_550' } });
    expect(o.statusCode, o.body).toBe(200);
    const { orderId, amount } = o.json();
    expect(amount).toBe(50000);
    const bad = await t.app.inject({ method: 'POST', url: '/payments/razorpay/verify', headers: auth(u.token), payload: { orderId, paymentId: 'pay_1', signature: 'nope' } });
    expect(bad.statusCode).toBe(400);
    const sig = hmacHex(KEY_SECRET, `${orderId}|pay_1`);
    const ok = await t.app.inject({ method: 'POST', url: '/payments/razorpay/verify', headers: auth(u.token), payload: { orderId, paymentId: 'pay_1', signature: sig } });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(await balance(t, u.id)).toBe(600); // 550 + 50 bonus
    // the webhook arrives later for the same order: no double credit
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: orderId } } } });
    const hook = await t.app.inject({ method: 'POST', url: '/webhooks/razorpay', headers: { 'content-type': 'application/json', 'x-razorpay-signature': hmacHex(HOOK_SECRET, body) }, payload: body });
    expect(hook.statusCode).toBe(200);
    expect(await balance(t, u.id)).toBe(600);
    // second purchase: no bonus
    const o2 = (await t.app.inject({ method: 'POST', url: '/payments/razorpay/order', headers: auth(u.token), payload: { productId: 'coins_100' } })).json();
    const body2 = JSON.stringify({ event: 'order.paid', payload: { order: { entity: { id: o2.orderId } } } });
    await t.app.inject({ method: 'POST', url: '/webhooks/razorpay', headers: { 'content-type': 'application/json', 'x-razorpay-signature': hmacHex(HOOK_SECRET, body2) }, payload: body2 });
    expect(await balance(t, u.id)).toBe(700);
    const gst = (await t.ctx.db.query('SELECT gst_paise FROM payments WHERE external_id=$1', [orderId])).rows[0].gst_paise;
    expect(gst).toBe(7627);
  });

  it('rejects a webhook with a bad signature', async () => {
    const body = JSON.stringify({ event: 'order.paid', payload: { order: { entity: { id: 'order_x' } } } });
    const r = await t.app.inject({ method: 'POST', url: '/webhooks/razorpay', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'forged' }, payload: body });
    expect(r.statusCode).toBe(400);
  });

  it('VIP purchase sets 30 days of VIP', async () => {
    const u = await signUp(t);
    const o = (await t.app.inject({ method: 'POST', url: '/payments/razorpay/order', headers: auth(u.token), payload: { productId: 'vip_month' } })).json();
    expect(o.amount).toBe(99900);
    await t.app.inject({ method: 'POST', url: '/payments/razorpay/verify', headers: auth(u.token), payload: { orderId: o.orderId, paymentId: 'pay_v', signature: hmacHex(KEY_SECRET, `${o.orderId}|pay_v`) } });
    const vip = (await t.ctx.db.query('SELECT vip_until FROM users WHERE id=$1', [u.id])).rows[0].vip_until;
    expect(new Date(vip).getTime()).toBeGreaterThan(Date.now() + 29 * 864e5);
  });
});

describe('Google Play Billing', () => {
  it('verifies, credits once and consumes a coin purchase', async () => {
    const u = await signUp(t);
    const p = { productId: 'coins_1200', purchaseToken: `tok_${Date.now()}`, type: 'inapp' };
    const r1 = await t.app.inject({ method: 'POST', url: '/payments/play/verify', headers: auth(u.token), payload: p });
    expect(r1.statusCode, r1.body).toBe(200);
    const r2 = await t.app.inject({ method: 'POST', url: '/payments/play/verify', headers: auth(u.token), payload: p });
    expect(r2.json().already).toBe(true);
    expect(await balance(t, u.id)).toBe(1250);
    expect(play.consumed).toContain(p.purchaseToken);
  });

  it('refuses another account reusing a purchase token, and unfinished purchases', async () => {
    const [a, b] = [await signUp(t), await signUp(t)];
    const p = { productId: 'coins_100', purchaseToken: `shared_${Date.now()}`, type: 'inapp' };
    await t.app.inject({ method: 'POST', url: '/payments/play/verify', headers: auth(a.token), payload: p });
    const steal = await t.app.inject({ method: 'POST', url: '/payments/play/verify', headers: auth(b.token), payload: p });
    expect(steal.statusCode).toBe(403);
    const pending = await t.app.inject({ method: 'POST', url: '/payments/play/verify', headers: auth(b.token), payload: { ...p, purchaseToken: 'bad_pending_1' } });
    expect(pending.statusCode).toBe(400);
  });

  it('activates VIP from a Play subscription', async () => {
    const u = await signUp(t);
    const r = await t.app.inject({ method: 'POST', url: '/payments/play/verify', headers: auth(u.token), payload: { productId: 'vip_monthly', purchaseToken: `sub_${Date.now()}`, type: 'subs' } });
    expect(r.statusCode, r.body).toBe(200);
    const vip = (await t.ctx.db.query('SELECT vip_until FROM users WHERE id=$1', [u.id])).rows[0].vip_until;
    expect(new Date(vip).getTime()).toBeGreaterThan(Date.now());
  });
});
