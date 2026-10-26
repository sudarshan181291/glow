// Customer, dancer and floor actions that are not bookings.
import { type After, type Ctx, runAfter } from '../ctx.js';
import { withTx } from '../db/pool.js';
import { bad, conflict, forbidden, notFound, tooMany } from '../lib/errors.js';
import { leaveStage, putOnStage, endBookingTx, type BookingRow } from './engine.js';
import { addEarning, applyLedger, changeCredits } from './ledger.js';
import { audit, emitDancer, followerIds, getStudio, lockStudio, notifyUsers, postChat, userName } from './studio.js';
import { stageRoom } from './video.js';

const BANNED_WORDS = ['fuck', 'bitch', 'chutiya', 'madarchod', 'bhenchod', 'randi', 'bc', 'mc'];
export function cleanText(s: string): string {
  let out = s.replace(/\s+/g, ' ').trim();
  for (const w of BANNED_WORDS) out = out.replace(new RegExp(`\\b${w}\\b`, 'gi'), '•'.repeat(w.length));
  return out;
}

async function vipActive(ctx: Ctx, q: { query: any }, userId: string) {
  const r = await q.query('SELECT vip_until, lifetime_spent FROM users WHERE id=$1', [userId]);
  const row = r.rows[0];
  return { vip: !!row?.vip_until && new Date(row.vip_until) > ctx.now(), lifetime: Number(row?.lifetime_spent ?? 0) };
}

// ---------------------------------------------------------------- customer spends

export async function sendGift(ctx: Ctx, userId: string, dancerId: string, giftId: string, idemKey: string) {
  return withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    const g = (await tx.query('SELECT * FROM gift_catalog WHERE id=$1 AND active', [giftId])).rows[0];
    if (!g) throw notFound('Gift not found');
    const d = (await tx.query('SELECT status, stage_name FROM dancers WHERE user_id=$1', [dancerId])).rows[0];
    if (!d) throw notFound('Dancer not found');
    const inMyRoom = d.status === 'private' && (await tx.query(
      `SELECT 1 FROM bookings WHERE dancer_id=$1 AND customer_id=$2 AND status='active'`, [dancerId, userId])).rows[0];
    if (d.status !== 'stage' && !inMyRoom) throw conflict('not_on_stage', `${d.stage_name} is not on stage right now`);
    const { vip, lifetime } = await vipActive(ctx, tx, userId);
    if (g.exclusive && !vip && lifetime < studio.config.exclusiveUnlock) {
      throw forbidden(`Exclusive gifts unlock after ${studio.config.exclusiveUnlock} coins spent or with VIP`);
    }
    const cost = vip ? Math.ceil((g.cost * (100 - studio.config.vipGiftDiscountPct)) / 100) : g.cost;
    const led = await applyLedger(tx, userId, -cost, 'gift', { refType: 'gift', refId: giftId, idemKey: `gift:${userId}:${idemKey}`, meta: { dancerId } });
    if (led.duplicate) return { balance: led.balance, duplicate: true };
    await addEarning(tx, dancerId, userId, 'gift', g.cost, giftId);
    const name = await userName(tx, userId);
    await postChat(ctx, tx, studio.id, dancerId, userId, 'gift', `sent ${g.emoji} ${g.name}`, name);
    await postChat(ctx, tx, studio.id, null, userId, 'gift', `sent ${g.emoji} ${g.name} → ${d.stage_name}`, name);
    await ctx.rt.publish(tx, { type: 'gift', data: { dancerId, from: name, giftId, emoji: g.emoji, name: g.name, cost: g.cost, anim: g.anim } });
    if (g.id === 'stagecall' || g.exclusive) {
      await ctx.rt.publish(tx, { type: 'spotlight', data: { dancerId, until: new Date(ctx.now().getTime() + 15000) } });
      await ctx.rt.publish(tx, { type: 'banner', data: { text: `${g.emoji} ${name} called ${d.stage_name} to centre stage!`, color: 'rose' } });
    } else if (g.cost >= 1000) {
      await ctx.rt.publish(tx, { type: 'banner', data: { text: `${g.emoji} ${name} sent ${g.name} to ${d.stage_name}!`, color: 'gold' } });
    }
    await emitDancer(ctx, tx, dancerId);
    return { balance: led.balance, duplicate: false };
  });
}

export async function shoutOut(ctx: Ctx, userId: string, dancerId: string, idemKey: string) {
  return withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    const d = (await tx.query('SELECT status, stage_name FROM dancers WHERE user_id=$1', [dancerId])).rows[0];
    if (!d || d.status !== 'stage') throw conflict('not_on_stage', 'She is not on stage right now');
    const cost = studio.config.shoutout;
    const led = await applyLedger(tx, userId, -cost, 'shoutout', { refType: 'dancer', refId: dancerId, idemKey: `shout:${userId}:${idemKey}` });
    if (led.duplicate) return { balance: led.balance };
    await addEarning(tx, dancerId, userId, 'shoutout', cost, null);
    const name = await userName(tx, userId);
    await ctx.rt.publish(tx, { type: 'banner', data: { text: `📣 ${d.stage_name}: "Shout-out to ${name}! Thank you for being here 💕"`, color: 'rose' } });
    await ctx.rt.publish(tx, { type: 'shoutout_request', to: dancerId, data: { from: name } });
    return { balance: led.balance };
  });
}

export async function requestSong(ctx: Ctx, userId: string, dancerId: string, songId: string, idemKey: string) {
  return withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    const s = (await tx.query('SELECT * FROM songs WHERE id=$1 AND active', [songId])).rows[0];
    if (!s) throw notFound('Song not found');
    const d = (await tx.query('SELECT status, stage_name FROM dancers WHERE user_id=$1', [dancerId])).rows[0];
    if (!d || d.status !== 'stage') throw conflict('not_on_stage', 'She is not on stage right now');
    const led = await applyLedger(tx, userId, -s.price, 'song', { refType: 'song', refId: songId, idemKey: `song:${userId}:${idemKey}` });
    if (led.duplicate) return { balance: led.balance };
    // Queue behind her other requests: ~90 s each
    const q = (await tx.query(`SELECT count(*)::int AS n FROM song_requests WHERE dancer_id=$1 AND status='queued'`, [dancerId])).rows[0].n;
    const r = (await tx.query(
      `INSERT INTO song_requests(user_id, dancer_id, song_id, cost, due_at) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [userId, dancerId, songId, s.price, new Date(ctx.now().getTime() + (q + 1) * 90000)],
    )).rows[0];
    await addEarning(tx, dancerId, userId, 'song', s.price, r.id);
    const name = await userName(tx, userId);
    await ctx.rt.publish(tx, { type: 'song_request', to: dancerId, data: { id: r.id, from: name, title: s.title } });
    await postChat(ctx, tx, studio.id, dancerId, userId, 'gift', `requested "${s.title}"`, name);
    return { balance: led.balance, position: q + 1 };
  });
}

export async function buyRoomPackage(ctx: Ctx, userId: string, idemKey: string) {
  return withTx(ctx.db, async (tx) => {
    const { config } = await getStudio(tx);
    const led = await applyLedger(tx, userId, -config.packageCoins, 'package', { idemKey: `package:${userId}:${idemKey}` });
    if (led.duplicate) return { balance: led.balance };
    const credits = await changeCredits(tx, userId, config.packageRooms);
    return { balance: led.balance, credits };
  });
}

export async function sendChat(ctx: Ctx, userId: string, dancerId: string | null, text: string) {
  return withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    const t = cleanText(text);
    if (!t) throw bad('empty', 'Message is empty');
    if (t.length > studio.config.chatMaxLen) throw bad('too_long', 'Message is too long');
    const recent = (await tx.query(
      `SELECT count(*)::int AS n FROM chat_messages WHERE user_id=$1 AND created_at > now() - interval '10 seconds'`, [userId])).rows[0].n;
    if (recent >= 5) throw tooMany('You are sending messages too fast');
    const u = (await tx.query('SELECT display_name, role FROM users WHERE id=$1', [userId])).rows[0];
    const kind = u.role === 'dancer' ? 'dancer' : 'me';
    await postChat(ctx, tx, studio.id, dancerId, userId, kind, t, u.display_name);
    return { ok: true };
  });
}

export async function toggleFollow(ctx: Ctx, userId: string, dancerId: string, follow: boolean) {
  return withTx(ctx.db, async (tx) => {
    if (follow) {
      const r = await tx.query('INSERT INTO follows(user_id, dancer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, dancerId]);
      if (r.rowCount) await tx.query('UPDATE dancers SET followers_count = followers_count + 1 WHERE user_id=$1', [dancerId]);
    } else {
      const r = await tx.query('DELETE FROM follows WHERE user_id=$1 AND dancer_id=$2', [userId, dancerId]);
      if (r.rowCount) await tx.query('UPDATE dancers SET followers_count = GREATEST(followers_count - 1, 0) WHERE user_id=$1', [dancerId]);
    }
    await emitDancer(ctx, tx, dancerId);
    return { following: follow };
  });
}

export async function report(ctx: Ctx, reporterId: string, body: { bookingId?: string; targetUserId?: string; reason: string }) {
  return withTx(ctx.db, async (tx) => {
    const r = (await tx.query(
      'INSERT INTO reports(reporter_id, target_user_id, booking_id, reason) VALUES ($1,$2,$3,$4) RETURNING id, created_at',
      [reporterId, body.targetUserId ?? null, body.bookingId ?? null, body.reason.slice(0, 500)],
    )).rows[0];
    await ctx.rt.publish(tx, { type: 'report', roles: ['moderator', 'floor'], data: { id: r.id, reason: body.reason, bookingId: body.bookingId ?? null, at: r.created_at } });
    return { id: r.id };
  });
}

// ---------------------------------------------------------------- dancer

export async function setAvailability(ctx: Ctx, dancerId: string, mode: 'available' | 'busy' | 'break' | 'off') {
  const after: After = [];
  const out = await withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await lockStudio(tx, studio.id);
    const d = (await tx.query('SELECT status, kyc_status FROM dancers WHERE user_id=$1 FOR UPDATE', [dancerId])).rows[0];
    if (!d) throw notFound('Dancer profile not found');
    if (d.status === 'private' && mode !== 'available' && mode !== 'busy') throw conflict('in_room', 'Finish your private room first');
    if (mode === 'available' || mode === 'busy') {
      if (d.kyc_status !== 'approved') throw forbidden('Your KYC must be approved before you can go on stage');
      await tx.query('UPDATE dancers SET busy=$2 WHERE user_id=$1', [dancerId, mode === 'busy']);
      if (d.status === 'off' || d.status === 'break') {
        await tx.query(`UPDATE dancers SET status='bench', since=now() WHERE user_id=$1`, [dancerId]);
        await putOnStage(ctx, tx, studio, after, dancerId, 'live'); // straight on if a slot is free, else waits on the bench
      }
      await emitDancer(ctx, tx, dancerId);
    } else {
      if (d.status === 'stage' || d.status === 'bench') await leaveStage(ctx, tx, studio, dancerId, mode);
      else await tx.query('UPDATE dancers SET status=$2, busy=false WHERE user_id=$1', [dancerId, mode]);
      await tx.query('UPDATE dancers SET camera_live=false WHERE user_id=$1', [dancerId]);
      await emitDancer(ctx, tx, dancerId);
    }
    return { mode };
  });
  await runAfter(ctx, after);
  return out;
}

export async function messageFollowers(ctx: Ctx, dancerId: string, text: string) {
  const after: After = [];
  const out = await withTx(ctx.db, async (tx) => {
    const { config } = await getStudio(tx);
    const d = (await tx.query('SELECT stage_name, last_follower_msg_at FROM dancers WHERE user_id=$1 FOR UPDATE', [dancerId])).rows[0];
    const last = d.last_follower_msg_at ? new Date(d.last_follower_msg_at).getTime() : 0;
    const wait = config.followerMsgIntervalMin * 60000 - (ctx.now().getTime() - last);
    if (wait > 0) throw tooMany(`You can message followers again in ${Math.ceil(wait / 60000)} min`);
    await tx.query('UPDATE dancers SET last_follower_msg_at=now() WHERE user_id=$1', [dancerId]);
    const ids = await followerIds(tx, dancerId);
    await notifyUsers(ctx, tx, after, ids, dancerId, `${d.stage_name}: ${cleanText(text).slice(0, 140)}`);
    return { sent: ids.length };
  });
  await runAfter(ctx, after);
  return out;
}

export async function blockCustomer(ctx: Ctx, dancerId: string, customerId: string, block: boolean) {
  return withTx(ctx.db, async (tx) => {
    if (block) {
      await tx.query('INSERT INTO blocks(dancer_id, customer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [dancerId, customerId]);
      await tx.query(`UPDATE bookings SET status='cancelled', ended_at=now(), end_reason='blocked'
        WHERE dancer_id=$1 AND customer_id=$2 AND status IN ('requested','waitlisted')`, [dancerId, customerId]);
    } else {
      await tx.query('DELETE FROM blocks WHERE dancer_id=$1 AND customer_id=$2', [dancerId, customerId]);
    }
    return { blocked: block };
  });
}

/** LiveKit token for a dancer to publish on the stage (only while she is on stage). */
export async function stagePublishToken(ctx: Ctx, dancerId: string) {
  const d = (await ctx.db.query('SELECT status, stage_name, studio_id, kyc_status FROM dancers WHERE user_id=$1', [dancerId])).rows[0];
  if (!d) throw notFound('Dancer profile not found');
  if (d.kyc_status !== 'approved') throw forbidden('KYC not approved');
  if (d.status !== 'stage') throw conflict('not_on_stage', 'You are not on stage yet — you will join when a slot frees up');
  const token = await ctx.video.token({ room: stageRoom(d.studio_id), identity: dancerId, name: d.stage_name, publish: true });
  return { url: ctx.video.url, room: stageRoom(d.studio_id), token };
}

// ---------------------------------------------------------------- floor

export async function floorSetStatus(ctx: Ctx, actorId: string, dancerId: string, status: 'stage' | 'bench' | 'break' | 'off') {
  const after: After = [];
  const out = await withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await lockStudio(tx, studio.id);
    const d = (await tx.query('SELECT status FROM dancers WHERE user_id=$1 FOR UPDATE', [dancerId])).rows[0];
    if (!d) throw notFound('Dancer not found');
    if (d.status === 'private') {
      const b = (await tx.query(`SELECT * FROM bookings WHERE dancer_id=$1 AND status='active' FOR UPDATE`, [dancerId])).rows[0] as BookingRow;
      if (b) await endBookingTx(ctx, tx, studio, after, b, 'floor');
      if (status === 'stage') { await audit(tx, actorId, 'floor.force_return', dancerId); return { ok: true }; }
    }
    if (status === 'stage') {
      if (d.status === 'stage') return { ok: true };
      if (!(await putOnStage(ctx, tx, studio, after, dancerId, 'floor'))) throw conflict('stage_full', 'Stage is full');
    } else {
      const cur = (await tx.query('SELECT status FROM dancers WHERE user_id=$1', [dancerId])).rows[0].status;
      if (cur === 'stage' || cur === 'bench') await leaveStage(ctx, tx, studio, dancerId, status);
      else { await tx.query('UPDATE dancers SET status=$2 WHERE user_id=$1', [dancerId, status]); await emitDancer(ctx, tx, dancerId); }
    }
    await audit(tx, actorId, 'floor.set_status', dancerId, { status });
    return { ok: true };
  });
  await runAfter(ctx, after);
  return out;
}

export async function killAllRooms(ctx: Ctx, actorId: string) {
  const after: After = [];
  const out = await withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await lockStudio(tx, studio.id);
    const rows = (await tx.query(`SELECT * FROM bookings WHERE studio_id=$1 AND status='active' FOR UPDATE`, [studio.id])).rows;
    for (const b of rows) await endBookingTx(ctx, tx, studio, after, b, 'kill');
    await ctx.rt.publish(tx, { type: 'banner', data: { text: '⛔ All private rooms were ended by the floor manager', color: 'red' } });
    await audit(tx, actorId, 'floor.kill_all', null, { ended: rows.length });
    return { ended: rows.length };
  });
  await runAfter(ctx, after);
  return out;
}

export async function announce(ctx: Ctx, actorId: string, text: string) {
  const t = cleanText(text).slice(0, 200);
  if (!t) throw bad('empty', 'Announcement is empty');
  await withTx(ctx.db, async (tx) => {
    const studio = await getStudio(tx);
    await ctx.rt.publish(tx, { type: 'banner', data: { text: `📢 ${t}`, color: 'gold' } });
    await postChat(ctx, tx, studio.id, null, null, 'system', `📢 ${t}`, null);
    await audit(tx, actorId, 'floor.announce', null, { text: t });
  });
  return { ok: true };
}
