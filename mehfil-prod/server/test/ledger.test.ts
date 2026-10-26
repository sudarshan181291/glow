import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTx } from '../src/db/pool.js';
import { applyLedger } from '../src/services/ledger.js';
import { balance, giveCoins, makeTestEnv, signUp, type TestEnv } from './helpers.js';

let t: TestEnv;
beforeAll(async () => { t = await makeTestEnv(); });
afterAll(async () => { await t.close(); });

describe('wallet ledger', () => {
  it('never goes negative under concurrent spending', async () => {
    const u = await signUp(t);
    await giveCoins(t, u.id, 1000);
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) => withTx(t.ctx.db, (tx) => applyLedger(tx, u.id, -100, 'gift', { idemKey: `c-${u.id}-${i}` }))),
    );
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(10);
    expect(await balance(t, u.id)).toBe(0);
    const sum = (await t.ctx.db.query('SELECT sum(delta)::bigint AS s FROM ledger_entries WHERE user_id=$1', [u.id])).rows[0].s;
    expect(Number(sum)).toBe(0);
  });

  it('applies an idempotency key only once', async () => {
    const u = await signUp(t);
    await giveCoins(t, u.id, 500);
    const a = await withTx(t.ctx.db, (tx) => applyLedger(tx, u.id, -200, 'gift', { idemKey: `same-${u.id}` }));
    const b = await withTx(t.ctx.db, (tx) => applyLedger(tx, u.id, -200, 'gift', { idemKey: `same-${u.id}` }));
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(await balance(t, u.id)).toBe(300);
  });
});
