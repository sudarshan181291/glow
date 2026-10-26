// Wallet ledger. All coin movements go through here inside a transaction.
// Guarantees: balance never negative (DB CHECK + explicit check), every change
// has a ledger entry, and an idempotency key makes retries safe.
import type { Tx } from '../db/pool.js';
import { conflict } from '../lib/errors.js';

export interface LedgerResult { balance: number; entryId: number; duplicate: boolean }

async function lockWallet(tx: Tx, userId: string) {
  await tx.query('INSERT INTO wallets(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  const r = await tx.query('SELECT balance, room_credits FROM wallets WHERE user_id=$1 FOR UPDATE', [userId]);
  return r.rows[0] as { balance: number; room_credits: number };
}

export async function applyLedger(
  tx: Tx,
  userId: string,
  delta: number,
  kind: string,
  opts: { refType?: string; refId?: string; idemKey?: string; meta?: Record<string, unknown> } = {},
): Promise<LedgerResult> {
  if (!Number.isInteger(delta)) throw new Error('delta must be an integer');
  if (opts.idemKey) {
    const dup = await tx.query('SELECT id, balance_after FROM ledger_entries WHERE idem_key=$1', [opts.idemKey]);
    if (dup.rows[0]) return { balance: dup.rows[0].balance_after, entryId: dup.rows[0].id, duplicate: true };
  }
  const w = await lockWallet(tx, userId);
  const next = w.balance + delta;
  if (next < 0) throw conflict('insufficient_coins', 'Not enough coins', { need: -delta, balance: w.balance });
  await tx.query('UPDATE wallets SET balance=$2, updated_at=now() WHERE user_id=$1', [userId, next]);
  const e = await tx.query(
    `INSERT INTO ledger_entries(user_id, delta, balance_after, kind, ref_type, ref_id, idem_key, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [userId, delta, next, kind, opts.refType ?? null, opts.refId ?? null, opts.idemKey ?? null, JSON.stringify(opts.meta ?? {})],
  );
  if (delta < 0) await tx.query('UPDATE users SET lifetime_spent = lifetime_spent + $2 WHERE id=$1', [userId, -delta]);
  return { balance: next, entryId: e.rows[0].id, duplicate: false };
}

export async function changeCredits(tx: Tx, userId: string, delta: number): Promise<number> {
  const w = await lockWallet(tx, userId);
  const next = w.room_credits + delta;
  if (next < 0) throw conflict('no_credits', 'No room credits left');
  await tx.query('UPDATE wallets SET room_credits=$2, updated_at=now() WHERE user_id=$1', [userId, next]);
  return next;
}

export async function getWallet(q: { query: Tx['query'] }, userId: string) {
  const r = await q.query('SELECT balance, room_credits FROM wallets WHERE user_id=$1', [userId]);
  return { balance: r.rows[0]?.balance ?? 0, credits: r.rows[0]?.room_credits ?? 0 };
}

/** Record a dancer's earning (and her share) for coins spent on her. */
export async function addEarning(
  tx: Tx,
  dancerId: string,
  customerId: string | null,
  kind: string,
  gross: number,
  refId: string | null,
): Promise<{ share: number }> {
  const d = await tx.query('SELECT split_pct FROM dancers WHERE user_id=$1', [dancerId]);
  const split = d.rows[0]?.split_pct ?? 50;
  const share = gross >= 0 ? Math.floor((gross * split) / 100) : -Math.floor((-gross * split) / 100);
  await tx.query(
    'INSERT INTO earnings(dancer_id, customer_id, kind, ref_id, gross, dancer_share) VALUES ($1,$2,$3,$4,$5,$6)',
    [dancerId, customerId, kind, refId, gross, share],
  );
  await tx.query('UPDATE dancers SET coins_earned = coins_earned + $2 WHERE user_id=$1', [dancerId, gross]);
  return { share };
}
