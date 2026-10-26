// Studio helpers: config, public views of dancers and rooms, chat, notifications.
import { DEFAULT_STUDIO_CONFIG, type StudioConfig } from '../config.js';
import type { After, Ctx } from '../ctx.js';
import type { Queryable, Tx } from '../db/pool.js';

export interface Studio { id: string; name: string; config: StudioConfig }

export async function getStudio(q: Queryable): Promise<Studio> {
  const r = await q.query('SELECT id, name, config FROM studios ORDER BY created_at LIMIT 1');
  if (!r.rows[0]) throw new Error('No studio configured. Run the seed script.');
  return { id: r.rows[0].id, name: r.rows[0].name, config: { ...DEFAULT_STUDIO_CONFIG, ...r.rows[0].config } };
}

/** Serialise all stage/room changes for a studio (inside a transaction). */
export async function lockStudio(tx: Tx, studioId: string) {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [studioId]);
}

export const DANCER_COLS = `d.user_id AS id, d.stage_name AS name, d.bio, d.langs, d.specs, d.city, d.photo_url, d.video_url,
  d.status, d.busy, d.camera_live, d.slot, d.since, d.return_at, d.followers_count, d.coins_earned, d.is_new, d.split_pct, d.kyc_status`;

export function publicDancer(r: Record<string, any>) {
  return {
    id: r.id, name: r.name, bio: r.bio, langs: r.langs, specs: r.specs, city: r.city,
    photoUrl: r.photo_url, videoUrl: r.video_url, status: r.status, busy: r.busy, cameraLive: r.camera_live,
    slot: r.slot, since: r.since, returnAt: r.return_at, followers: r.followers_count, coins: Number(r.coins_earned), isNew: r.is_new,
  };
}

export async function loadDancer(q: Queryable, id: string) {
  const r = await q.query(`SELECT ${DANCER_COLS} FROM dancers d WHERE d.user_id=$1`, [id]);
  return r.rows[0] ? publicDancer(r.rows[0]) : null;
}

export async function emitDancer(ctx: Ctx, tx: Queryable, id: string) {
  const d = await loadDancer(tx, id);
  if (d) await ctx.rt.publish(tx, { type: 'dancer', data: d });
}

export async function publicRooms(q: Queryable, studioId: string) {
  const r = await q.query(
    `SELECT id, dancer_id, customer_id, minutes, started_at, ends_at FROM bookings WHERE studio_id=$1 AND status='active' ORDER BY started_at`,
    [studioId],
  );
  return r.rows.map((b) => ({ id: b.id, dancerId: b.dancer_id, customerId: b.customer_id, minutes: b.minutes, startedAt: b.started_at, endsAt: b.ends_at }));
}

/** Broadcast the room list. Customer identities are never broadcast; each customer recognises their own room by booking id. */
export async function emitRooms(ctx: Ctx, tx: Queryable, studioId: string) {
  const rooms = (await publicRooms(tx, studioId)).map(({ customerId, ...r }) => r);
  await ctx.rt.publish(tx, { type: 'rooms', data: rooms });
}

export async function postChat(
  ctx: Ctx, tx: Queryable, studioId: string, dancerId: string | null, userId: string | null, kind: string, text: string, userName: string | null,
) {
  const r = await tx.query(
    'INSERT INTO chat_messages(studio_id, dancer_id, user_id, kind, text) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at',
    [studioId, dancerId, userId, kind, text],
  );
  await ctx.rt.publish(tx, { type: 'chat', data: { id: r.rows[0].id, dancerId, userId, user: userName, kind, text, at: r.rows[0].created_at } });
}

/** In-app notification + push (after commit) to a set of users. */
export async function notifyUsers(ctx: Ctx, tx: Tx, after: After, userIds: string[], dancerId: string | null, text: string) {
  if (!userIds.length) return;
  await tx.query(
    'INSERT INTO notifications(user_id, dancer_id, text) SELECT u, $2, $3 FROM unnest($1::uuid[]) AS u',
    [userIds, dancerId, text],
  );
  for (const u of userIds) await ctx.rt.publish(tx, { type: 'notification', to: u, data: { dancerId, text, at: new Date() } });
  after.push(() => ctx.push.send(userIds, 'Mehfil Live', text, { dancerId }));
}

export async function followerIds(q: Queryable, dancerId: string): Promise<string[]> {
  const r = await q.query('SELECT user_id FROM follows WHERE dancer_id=$1', [dancerId]);
  return r.rows.map((x) => x.user_id);
}

export async function audit(q: Queryable, actorId: string | null, action: string, target: string | null, meta: Record<string, unknown> = {}) {
  await q.query('INSERT INTO audit_log(actor_id, action, target, meta) VALUES ($1,$2,$3,$4)', [actorId, action, target, JSON.stringify(meta)]);
}

export async function userName(q: Queryable, id: string): Promise<string> {
  const r = await q.query('SELECT display_name FROM users WHERE id=$1', [id]);
  return r.rows[0]?.display_name ?? 'someone';
}
