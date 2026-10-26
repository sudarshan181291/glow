// The movement engine: stage slots, bench, private rooms, backfill, bookings.
// The server is the single source of truth; the app only displays what it sends.
import type pg from 'pg';
import { type After, type Ctx, runAfter } from '../ctx.js';
import { type Tx, withTx } from '../db/pool.js';
import { bad, conflict, forbidden, notFound } from '../lib/errors.js';
import { addEarning, applyLedger, changeCredits } from './ledger.js';
import {
  emitDancer, emitRooms, followerIds, getStudio, lockStudio, notifyUsers, postChat, type Studio, userName,
} from './studio.js';
import { privateRoom } from './video.js';

// ---------------------------------------------------------------- stage moves

async function stageCount(tx: Tx, studioId: string) {
  const r = await tx.query(`SELECT count(*)::int AS n FROM dancers WHERE studio_id=$1 AND status='stage'`, [studioId]);
  return r.rows[0].n as number;
}
async function benchCount(tx: Tx, studioId: string) {
  const r = await tx.query(`SELECT count(*)::int AS n FROM dancers WHERE studio_id=$1 AND status='bench'`, [studioId]);
  return r.rows[0].n as number;
}
async function freeSlot(tx: Tx, studio: Studio): Promise<number | null> {
  const r = await tx.query(`SELECT slot FROM dancers WHERE studio_id=$1 AND slot IS NOT NULL`, [studio.id]);
  const used = new Set(r.rows.map((x) => x.slot));
  for (let i = 0; i < studio.config.stageCap; i++) if (!used.has(i)) return i;
  return null;
}

/** Bench or off → stage (if a slot is free). Returns false if the stage is full. */
export async function putOnStage(ctx: Ctx, tx: Tx, studio: Studio, after: After, dancerId: string, why: 'backfill' | 'return' | 'floor' | 'live'): Promise<boolean> {
  const slot = await freeSlot(tx, studio);
  if (slot === null) return false;
  await tx.query(`UPDATE dancers SET status='stage', slot=$2, since=now(), return_at=NULL WHERE user_id=$1`, [dancerId, slot]);
  const name = (await tx.query('SELECT stage_name FROM dancers WHERE user_id=$1', [dancerId])).rows[0].stage_name;
  await emitDancer(ctx, tx, dancerId);
  if (why === 'return') {
    await postChat(ctx, tx, studio.id, null, null, 'system', `${name} is back on stage`, null);
    await notifyUsers(ctx, tx, after, await followerIds(tx, dancerId), dancerId, `${name} is free now — back on stage`);
  } else {
    await postChat(ctx, tx, studio.id, null, null, 'system', `💃 ${name} walked onto the stage`, null);
    await notifyUsers(ctx, tx, after, await followerIds(tx, dancerId), dancerId, `${name} is live now`);
  }
  return true;
}

/** Stage → private/bench/break/off. Refunds her queued song requests. */
export async function leaveStage(ctx: Ctx, tx: Tx, studio: Studio, dancerId: string, status: 'private' | 'bench' | 'break' | 'off') {
  await tx.query(`UPDATE dancers SET status=$2, slot=NULL, since=now(), busy=CASE WHEN $2 IN ('break','off') THEN false ELSE busy END WHERE user_id=$1`, [dancerId, status]);
  const songs = await tx.query(`UPDATE song_requests SET status='refunded' WHERE dancer_id=$1 AND status='queued' RETURNING id, user_id, cost`, [dancerId]);
  for (const s of songs.rows) {
    await applyLedger(tx, s.user_id, s.cost, 'refund', { refType: 'song', refId: s.id, idemKey: `song:${s.id}:refund` });
    await addEarning(tx, dancerId, s.user_id, 'refund', -s.cost, s.id);
    await ctx.rt.publish(tx, { type: 'toast', to: s.user_id, data: { text: 'Your song request was refunded — she left the stage' } });
  }
  await emitDancer(ctx, tx, dancerId);
}

/** After a private room: back to the stage, or the bench if the stage is full. */
async function returnFromRoom(ctx: Ctx, tx: Tx, studio: Studio, after: After, dancerId: string) {
  const d = (await tx.query('SELECT status FROM dancers WHERE user_id=$1', [dancerId])).rows[0];
  if (d.status !== 'private') return;
  const ok = await putOnStage(ctx, tx, studio, after, dancerId, 'return');
  if (!ok) {
    await tx.query(`UPDATE dancers SET status='bench', slot=NULL, since=now(), return_at=NULL WHERE user_id=$1`, [dancerId]);
    await emitDancer(ctx, tx, dancerId);
  }
}

/** The stage minimum: a stage dancer may leave only if the stage stays at/above minimum or the bench can refill it. */
async function canLeaveStage(tx: Tx, studio: Studio, dancerId: string) {
  const d = (await tx.query('SELECT status FROM dancers WHERE user_id=$1', [dancerId])).rows[0];
  if (d.status !== 'stage') return true;
  const s = await stageCount(tx, studio.id);
  return s - 1 >= studio.config.minStage || (await benchCount(tx, studio.id)) > 0;
}

// ---------------------------------------------------------------- bookings

export interface BookingRow {
  id: string; studio_id: string; customer_id: string; dancer_id: string; minutes: number; price: number; credit_used: boolean;
  status: string; priority: number; decide_by: Date | null; started_at: Date | null; ends_at: Date | null; charged: number; room_name: string | null;
}

async function lockBooking(tx: Tx, id: string): Promise<BookingRow> {
  const r = await tx.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [id]);
  if (!r.rows[0]) throw notFound('Booking not found');
  return r.rows[0];
}

function publicBooking(b: BookingRow) {
  return {
    id: b.id, dancerId: b.dancer_id, customerId: b.customer_id, minutes: b.minutes, price: b.price, creditUsed: b.credit_used,
    status: b.status, decideBy: b.decide_by, startedAt: b.started_at, endsAt: b.ends_at,
  };
}

async function emitBooking(ctx: Ctx, tx: Tx, b: BookingRow, extra: Record<string, unknown> = {}) {
  const data = { ...publicBooking(b), ...extra };
  await ctx.rt.publish(tx, { type: 'booking', to: b.customer_id, data });
  await ctx.rt.publish(tx, { type: 'booking', to: b.dancer_id, data });
}

async function isTopFan(tx: Tx, dancerId: string, customerId: string) {
  const r = await tx.query(
    `SELECT customer_id FROM earnings WHERE dancer_id=$1 AND customer_id IS NOT NULL GROUP BY customer_id ORDER BY sum(gross) DESC LIMIT 1`,
    [dancerId],
  );
  return r.rows[0]?.customer_id === customerId;
}

/** Customer asks for a private room. Coins are taken only when she accepts. */
export async function requestBooking(ctx: Ctx, customerId: string, dancerId: string, minutes: 5 | 15, useCredit: boolean) {
  return withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await lockStudio(tx, studio.id);
    const cfg = studio.config;
    const u = (await tx.query('SELECT banned_at, age_confirmed_at, vip_until FROM users WHERE id=$1', [customerId])).rows[0];
    if (!u || u.banned_at) throw forbidden('Your account cannot book rooms');
    if (!u.age_confirmed_at) throw forbidden('Please confirm you are 18 or older');
    const d = (await tx.query('SELECT status, busy, kyc_status, stage_name, split_pct FROM dancers WHERE user_id=$1', [dancerId])).rows[0];
    if (!d) throw notFound('Dancer not found');
    if ((await tx.query('SELECT 1 FROM blocks WHERE dancer_id=$1 AND customer_id=$2', [dancerId, customerId])).rows[0]) throw forbidden(`${d.stage_name} is not available`);
    if (d.status === 'private') throw conflict('dancer_busy', `${d.stage_name} is in a private room`);
    if (!['stage', 'bench'].includes(d.status) || d.busy) throw conflict('dancer_unavailable', `${d.stage_name} is not taking private rooms right now`);
    if (useCredit && minutes !== 5) throw bad('credit_5_only', 'Room credits are for 5-minute rooms');
    const price = useCredit ? 0 : minutes === 5 ? cfg.price5 : cfg.price15;
    if (useCredit) {
      const c = (await tx.query('SELECT room_credits FROM wallets WHERE user_id=$1', [customerId])).rows[0];
      if (!c || c.room_credits < 1) throw conflict('no_credits', 'No room credits left');
    } else {
      const w = (await tx.query('SELECT balance FROM wallets WHERE user_id=$1', [customerId])).rows[0];
      if (!w || w.balance < price) throw conflict('insufficient_coins', 'Not enough coins', { need: price, balance: w?.balance ?? 0 });
    }
    const active = (await tx.query(`SELECT count(*)::int AS n FROM bookings WHERE studio_id=$1 AND status='active'`, [studio.id])).rows[0].n;
    const vip = u.vip_until && new Date(u.vip_until) > ctx.now();
    const priority = vip || (await isTopFan(tx, dancerId, customerId)) ? 1 : 0;
    const waitlist = active >= cfg.maxRooms;
    let b: BookingRow;
    try {
      b = (await tx.query(
        `INSERT INTO bookings(studio_id, customer_id, dancer_id, minutes, price, credit_used, status, priority, decide_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [studio.id, customerId, dancerId, minutes, price, useCredit, waitlist ? 'waitlisted' : 'requested', priority,
          waitlist ? null : new Date(ctx.now().getTime() + cfg.requestTimeoutSec * 1000)],
      )).rows[0];
    } catch (e) {
      if ((e as pg.DatabaseError).code === '23505') throw conflict('open_booking', 'You already have a room or request in progress');
      throw e;
    }
    if (!waitlist) {
      const name = await userName(tx, customerId);
      await ctx.rt.publish(tx, { type: 'incoming_request', to: dancerId, data: { ...publicBooking(b), customer: name, share: Math.floor((price * d.split_pct) / 100) } });
    }
    await emitBooking(ctx, tx, b);
    return publicBooking(b);
  });
}

/** Dancer accepts: charge the customer, move her off stage, open the video room. */
export async function acceptBooking(ctx: Ctx, dancerId: string, bookingId: string) {
  const after: After = [];
  const out = await withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await lockStudio(tx, studio.id);
    const b = await lockBooking(tx, bookingId);
    if (b.dancer_id !== dancerId) throw forbidden();
    if (b.status !== 'requested') throw conflict('not_pending', 'This request is no longer pending');
    if (b.decide_by && new Date(b.decide_by) < ctx.now()) throw conflict('expired', 'This request has expired');
    const active = (await tx.query(`SELECT count(*)::int AS n FROM bookings WHERE studio_id=$1 AND status='active'`, [studio.id])).rows[0].n;
    if (active >= studio.config.maxRooms) throw conflict('rooms_full', 'All private rooms are busy');
    if (!(await canLeaveStage(tx, studio, dancerId))) throw conflict('stage_minimum', 'The stage is at its minimum — try again shortly');

    let charged = 0;
    if (b.credit_used) {
      await changeCredits(tx, b.customer_id, -1);
    } else {
      try {
        await applyLedger(tx, b.customer_id, -b.price, 'room', { refType: 'booking', refId: b.id, idemKey: `booking:${b.id}:charge` });
      } catch (e) {
        await tx.query(`UPDATE bookings SET status='cancelled', end_reason='insufficient_coins' WHERE id=$1`, [b.id]);
        throw e;
      }
      charged = b.price;
    }
    // Earnings: credit-based rooms are paid from the package price at the time of purchase.
    const gross = b.credit_used ? Math.floor(studio.config.packageCoins / studio.config.packageRooms) : b.price;
    await addEarning(tx, dancerId, b.customer_id, 'room', gross, b.id);

    const now = ctx.now();
    const ends = new Date(now.getTime() + b.minutes * 60000);
    const room = privateRoom(b.id);
    const nb = (await tx.query(
      `UPDATE bookings SET status='active', started_at=$2, ends_at=$3, charged=$4, room_name=$5 WHERE id=$1 RETURNING *`,
      [b.id, now, ends, charged, room],
    )).rows[0] as BookingRow;
    await leaveStage(ctx, tx, studio, dancerId, 'private');
    await tx.query('UPDATE dancers SET return_at=$2 WHERE user_id=$1', [dancerId, ends]);
    await emitDancer(ctx, tx, dancerId);
    const [dn, cn] = [(await tx.query('SELECT stage_name FROM dancers WHERE user_id=$1', [dancerId])).rows[0].stage_name, await userName(tx, b.customer_id)];
    await postChat(ctx, tx, studio.id, null, null, 'system', `${dn} left the stage for a private room with ${cn}`, null);
    await emitBooking(ctx, tx, nb);
    await emitRooms(ctx, tx, studio.id);
    await ctx.rt.publish(tx, { type: 'wallet_changed', to: b.customer_id, data: {} });
    after.push(() => ctx.video.createRoom(room, 4));
    return publicBooking(nb);
  });
  await runAfter(ctx, after);
  return out;
}

export async function declineBooking(ctx: Ctx, dancerId: string, bookingId: string) {
  return withTx(ctx.db, async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.dancer_id !== dancerId) throw forbidden();
    if (b.status !== 'requested') throw conflict('not_pending', 'This request is no longer pending');
    const nb = (await tx.query(`UPDATE bookings SET status='declined', ended_at=now() WHERE id=$1 RETURNING *`, [b.id])).rows[0];
    await emitBooking(ctx, tx, nb);
    return publicBooking(nb);
  });
}

export async function cancelBooking(ctx: Ctx, customerId: string, bookingId: string) {
  return withTx(ctx.db, async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.customer_id !== customerId) throw forbidden();
    if (!['requested', 'waitlisted'].includes(b.status)) throw conflict('not_pending', 'This request can no longer be cancelled');
    const nb = (await tx.query(`UPDATE bookings SET status='cancelled', ended_at=now() WHERE id=$1 RETURNING *`, [b.id])).rows[0];
    await emitBooking(ctx, tx, nb);
    return publicBooking(nb);
  });
}

export async function extendBooking(ctx: Ctx, customerId: string, bookingId: string) {
  return withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    const b = await lockBooking(tx, bookingId);
    if (b.customer_id !== customerId) throw forbidden();
    if (b.status !== 'active') throw conflict('not_active', 'This room is not active');
    const n = (await tx.query(`SELECT count(*)::int AS n FROM ledger_entries WHERE ref_type='booking' AND ref_id=$1 AND kind='extend'`, [b.id])).rows[0].n;
    await applyLedger(tx, customerId, -studio.config.ext, 'extend', { refType: 'booking', refId: b.id, idemKey: `booking:${b.id}:extend:${n + 1}` });
    await addEarning(tx, b.dancer_id, customerId, 'extend', studio.config.ext, b.id);
    const nb = (await tx.query(
      `UPDATE bookings SET ends_at = ends_at + interval '5 minutes', charged = charged + $2, minutes = minutes WHERE id=$1 RETURNING *`,
      [b.id, studio.config.ext],
    )).rows[0] as BookingRow;
    await tx.query('UPDATE dancers SET return_at=$2 WHERE user_id=$1', [b.dancer_id, nb.ends_at]);
    await emitDancer(ctx, tx, b.dancer_id);
    await emitBooking(ctx, tx, nb);
    await emitRooms(ctx, tx, studio.id);
    await ctx.rt.publish(tx, { type: 'wallet_changed', to: customerId, data: {} });
    return publicBooking(nb);
  });
}

export type EndReason = 'time' | 'customer' | 'dancer' | 'floor' | 'kill' | 'disconnect';

/** End a room inside an existing transaction. Pro-rata refund unless the customer ended it or time ran out. */
export async function endBookingTx(ctx: Ctx, tx: Tx, studio: Studio, after: After, b: BookingRow, reason: EndReason) {
  if (b.status !== 'active') return publicBooking(b);
  const now = ctx.now();
  let refund = 0;
  if (['dancer', 'floor', 'kill', 'disconnect'].includes(reason) && b.ends_at && now < new Date(b.ends_at) && b.charged > 0) {
    const total = new Date(b.ends_at).getTime() - new Date(b.started_at!).getTime();
    const left = new Date(b.ends_at).getTime() - now.getTime();
    refund = Math.floor((b.charged * left) / total);
    if (refund > 0) {
      await applyLedger(tx, b.customer_id, refund, 'refund', { refType: 'booking', refId: b.id, idemKey: `booking:${b.id}:refund` });
      await addEarning(tx, b.dancer_id, b.customer_id, 'refund', -refund, b.id);
      await ctx.rt.publish(tx, { type: 'wallet_changed', to: b.customer_id, data: {} });
    }
  }
  const nb = (await tx.query(
    `UPDATE bookings SET status='ended', ended_at=$2, end_reason=$3, refunded=$4 WHERE id=$1 RETURNING *`,
    [b.id, now, reason, refund],
  )).rows[0] as BookingRow;
  await returnFromRoom(ctx, tx, studio, after, b.dancer_id);
  await emitBooking(ctx, tx, nb, { endReason: reason, refund });
  await emitRooms(ctx, tx, studio.id);
  if (b.room_name) after.push(() => ctx.video.deleteRoom(b.room_name!));
  return { ...publicBooking(nb), refund, endReason: reason };
}

export async function endBooking(ctx: Ctx, bookingId: string, reason: EndReason, actor?: { id: string; role: string }) {
  const after: After = [];
  const out = await withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await lockStudio(tx, studio.id);
    const b = await lockBooking(tx, bookingId);
    if (actor && reason === 'customer' && b.customer_id !== actor.id) throw forbidden();
    if (actor && reason === 'dancer' && b.dancer_id !== actor.id) throw forbidden();
    if (b.status !== 'active') throw conflict('not_active', 'This room is not active');
    return endBookingTx(ctx, tx, studio, after, b, reason);
  });
  await runAfter(ctx, after);
  return out;
}

// ---------------------------------------------------------------- the tick

/** One pass of the engine. Safe to run from one leader at a time (see EngineRunner). */
export async function tick(ctx: Ctx) {
  const after: After = [];
  await withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await lockStudio(tx, studio.id);
    const cfg = studio.config;
    const now = ctx.now();

    // 1. Requests nobody answered
    const expired = await tx.query(
      `UPDATE bookings SET status='expired', ended_at=$2 WHERE studio_id=$1 AND status='requested' AND decide_by < $2 RETURNING *`,
      [studio.id, now],
    );
    for (const b of expired.rows) await emitBooking(ctx, tx, b);

    // 2. Rooms whose time is up
    const due = await tx.query(`SELECT * FROM bookings WHERE studio_id=$1 AND status='active' AND ends_at <= $2 FOR UPDATE`, [studio.id, now]);
    for (const b of due.rows) await endBookingTx(ctx, tx, studio, after, b, 'time');
    const dropped = await tx.query(
      `SELECT * FROM bookings WHERE studio_id=$1 AND status='active' AND dancer_left_at < $2 FOR UPDATE`, [studio.id, new Date(now.getTime() - 60000)]);
    for (const b of dropped.rows) await endBookingTx(ctx, tx, studio, after, b, 'disconnect');

    // 3. Waitlist → request, when a room is free (priority fans first)
    let active = (await tx.query(`SELECT count(*)::int AS n FROM bookings WHERE studio_id=$1 AND status IN ('active','requested')`, [studio.id])).rows[0].n;
    if (active < cfg.maxRooms) {
      const w = await tx.query(
        `SELECT b.* FROM bookings b JOIN dancers d ON d.user_id=b.dancer_id
         WHERE b.studio_id=$1 AND b.status='waitlisted' AND d.status IN ('stage','bench') AND NOT d.busy
         ORDER BY b.priority DESC, b.created_at LIMIT $2`,
        [studio.id, cfg.maxRooms - active],
      );
      for (const b of w.rows) {
        const nb = (await tx.query(`UPDATE bookings SET status='requested', decide_by=$2 WHERE id=$1 RETURNING *`,
          [b.id, new Date(now.getTime() + cfg.requestTimeoutSec * 1000)])).rows[0];
        const name = await userName(tx, b.customer_id);
        await ctx.rt.publish(tx, { type: 'incoming_request', to: b.dancer_id, data: { ...publicBooking(nb), customer: name } });
        await emitBooking(ctx, tx, nb);
        active += 1;
      }
    }

    // 4. Backfill the stage from the bench (longest waiting first)
    let stage = await stageCount(tx, studio.id);
    while (stage < cfg.stageCap) {
      const next = (await tx.query(
        `SELECT user_id, since FROM dancers WHERE studio_id=$1 AND status='bench' ORDER BY since LIMIT 1`, [studio.id])).rows[0];
      if (!next) break;
      const waitedMs = now.getTime() - new Date(next.since).getTime();
      if (stage >= cfg.minStage && waitedMs < cfg.backfillDelayMs) break;
      if (!(await putOnStage(ctx, tx, studio, after, next.user_id, 'backfill'))) break;
      stage += 1;
    }

    // 5. Song dedications that are due
    const songs = await tx.query(
      `SELECT s.*, g.title, d.status AS dstatus, d.stage_name, u.display_name FROM song_requests s
       JOIN songs g ON g.id=s.song_id JOIN dancers d ON d.user_id=s.dancer_id JOIN users u ON u.id=s.user_id
       WHERE s.status='queued' AND s.due_at <= $1 FOR UPDATE OF s`, [now]);
    for (const s of songs.rows) {
      if (s.dstatus === 'stage') {
        await tx.query(`UPDATE song_requests SET status='played' WHERE id=$1`, [s.id]);
        await postChat(ctx, tx, studio.id, null, null, 'system', `🎶 ${s.stage_name} is dancing to "${s.title}" — dedicated to ${s.display_name}`, null);
        await ctx.rt.publish(tx, { type: 'banner', data: { text: `🎶 ${s.stage_name} dedicates "${s.title}" to ${s.display_name}`, color: 'rose' } });
      } else {
        await tx.query(`UPDATE song_requests SET status='refunded' WHERE id=$1`, [s.id]);
        await applyLedger(tx, s.user_id, s.cost, 'refund', { refType: 'song', refId: s.id, idemKey: `song:${s.id}:refund` });
        await addEarning(tx, s.dancer_id, s.user_id, 'refund', -s.cost, s.id);
        await ctx.rt.publish(tx, { type: 'wallet_changed', to: s.user_id, data: {} });
      }
    }
  });
  await runAfter(ctx, after);
}

/**
 * Runs tick() every ENGINE_TICK_MS on exactly one server instance:
 * instances compete for a PostgreSQL advisory lock; the holder is the leader.
 */
export class EngineRunner {
  private client?: pg.PoolClient;
  private timer?: NodeJS.Timeout;
  private leader = false;
  private busy = false;
  constructor(private ctx: Ctx) {}

  async start() {
    this.client = await this.ctx.db.connect();
    const loop = async () => {
      if (!this.leader) {
        const r = await this.client!.query('SELECT pg_try_advisory_lock(815001) AS ok');
        this.leader = r.rows[0].ok;
        if (this.leader) this.ctx.log.info('engine: this instance is the leader');
      }
      if (this.leader && !this.busy) {
        this.busy = true;
        try { await tick(this.ctx); } catch (e) { this.ctx.log.error(e, 'engine tick failed'); } finally { this.busy = false; }
      }
    };
    this.timer = setInterval(() => { loop().catch((e) => this.ctx.log.error(e, 'engine loop')); }, this.ctx.env.ENGINE_TICK_MS);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.client) {
      if (this.leader) await this.client.query('SELECT pg_advisory_unlock(815001)').catch(() => {});
      this.client.release();
    }
  }
}
