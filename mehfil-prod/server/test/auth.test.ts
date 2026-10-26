import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, makeTestEnv, newPhone, signUp, type TestEnv } from './helpers.js';

let t: TestEnv;
beforeAll(async () => { t = await makeTestEnv(); });
afterAll(async () => { await t.close(); });

describe('auth', () => {
  it('signs up with phone OTP, name and age', async () => {
    const u = await signUp(t, 'Raja_007');
    const me = await t.app.inject({ method: 'GET', url: '/me', headers: auth(u.token) });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.displayName).toBe('Raja_007');
    expect(me.json().wallet.balance).toBe(0);
  });

  it('rejects under-18 sign-ups', async () => {
    const phone = newPhone();
    await t.app.inject({ method: 'POST', url: '/auth/otp/request', payload: { phone } });
    const r = await t.app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { phone, code: '123456', displayName: 'kiddo_x', dob: '2012-01-01', ageConfirmed: true } });
    expect(r.statusCode).toBe(403);
  });

  it('rejects a wrong code and limits attempts', async () => {
    const phone = newPhone();
    await t.app.inject({ method: 'POST', url: '/auth/otp/request', payload: { phone } });
    for (let i = 0; i < 5; i++) {
      const r = await t.app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { phone, code: '000000' } });
      expect(r.statusCode).toBe(401);
    }
    const r = await t.app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { phone, code: '123456', displayName: 'late_one', dob: '1990-01-01', ageConfirmed: true } });
    expect(r.statusCode).toBe(429);
  });

  it('rejects invalid phone numbers', async () => {
    const r = await t.app.inject({ method: 'POST', url: '/auth/otp/request', payload: { phone: '12345' } });
    expect(r.statusCode).toBe(400);
  });

  it('rotates refresh tokens and refuses reuse', async () => {
    const u = await signUp(t);
    const r1 = await t.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refresh: u.refresh } });
    expect(r1.statusCode).toBe(200);
    const r2 = await t.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refresh: u.refresh } });
    expect(r2.statusCode).toBe(401);
  });

  it('lets guests watch but not spend', async () => {
    const g = (await t.app.inject({ method: 'POST', url: '/auth/guest' })).json();
    const studio = await t.app.inject({ method: 'GET', url: '/studio', headers: auth(g.access) });
    expect(studio.statusCode).toBe(200);
    expect(studio.json().gifts.length).toBeGreaterThan(5);
    const tok = await t.app.inject({ method: 'GET', url: '/stage/token', headers: auth(g.access) });
    expect(tok.statusCode).toBe(200);
    const gift = await t.app.inject({ method: 'POST', url: '/gifts', headers: auth(g.access), payload: { dancerId: '00000000-0000-0000-0000-000000000000', giftId: 'rose', idemKey: 'abcdefgh' } });
    expect(gift.statusCode).toBe(401);
  });

  it('refuses requests without a token', async () => {
    const r = await t.app.inject({ method: 'GET', url: '/studio' });
    expect(r.statusCode).toBe(401);
  });
});
