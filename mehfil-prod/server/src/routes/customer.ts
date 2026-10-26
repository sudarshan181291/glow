import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../ctx.js';
import { requireAny, requireUser } from '../lib/auth.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import {
  buyRoomPackage, report, requestSong, sendChat, sendGift, shoutOut, toggleFollow,
} from '../services/actions.js';
import { cancelBooking, endBooking, extendBooking, requestBooking } from '../services/engine.js';
import { getWallet } from '../services/ledger.js';
import { DANCER_COLS, getStudio, publicDancer, publicRooms } from '../services/studio.js';
import { stageRoom } from '../services/video.js';

const Uuid = z.string().uuid();
const Idem = z.string().min(8).max(80);

export async function snapshot(ctx: Ctx, userId: string | null) {
  const studio = await getStudio(ctx.db);
  const [dancers, rooms, chat, gifts, songs] = await Promise.all([
    ctx.db.query(`SELECT ${DANCER_COLS} FROM dancers d WHERE d.studio_id=$1 AND d.kyc_status='approved' ORDER BY d.coins_earned DESC`, [studio.id]),
    publicRooms(ctx.db, studio.id),
    ctx.db.query(
      `SELECT m.id, m.dancer_id, m.user_id, m.kind, m.text, m.created_at, u.display_name FROM chat_messages m LEFT JOIN users u ON u.id=m.user_id
       WHERE m.studio_id=$1 AND m.dancer_id IS NULL AND NOT m.hidden ORDER BY m.id DESC LIMIT 50`, [studio.id]),
    ctx.db.query('SELECT id, name, emoji, cost, anim, seasonal, exclusive FROM gift_catalog WHERE active ORDER BY sort, cost'),
    ctx.db.query('SELECT id, title, cat, price FROM songs WHERE active ORDER BY price'),
  ]);
  const { coinValuePaise, ...publicConfig } = studio.config;
  return {
    studio: { id: studio.id, name: studio.name, config: publicConfig },
    dancers: dancers.rows.map(publicDancer),
    rooms: rooms.map(({ customerId, ...r }) => ({ ...r, mine: !!userId && customerId === userId })),
    stageChat: chat.rows.reverse().map((m) => ({ id: m.id, dancerId: m.dancer_id, userId: m.user_id, user: m.display_name, kind: m.kind, text: m.text, at: m.created_at })),
    gifts: gifts.rows,
    songs: songs.rows,
    serverTime: ctx.now(),
  };
}

export function customerRoutes(app: FastifyInstance, ctx: Ctx) {
  // ---------- watching (guests allowed)
  app.get('/studio', async (req) => snapshot(ctx, requireAny(req).guest ? null : req.auth!.id));

  app.get('/dancers/:id', async (req) => {
    requireAny(req);
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const d = (await ctx.db.query(`SELECT ${DANCER_COLS} FROM dancers d WHERE d.user_id=$1`, [id])).rows[0];
    if (!d) throw notFound('Dancer not found');
    const fans = await ctx.db.query(
      `SELECT u.display_name AS name, sum(e.gross)::bigint AS coins FROM earnings e JOIN users u ON u.id=e.customer_id
       WHERE e.dancer_id=$1 GROUP BY u.display_name ORDER BY coins DESC LIMIT 5`, [id]);
    const chat = await ctx.db.query(
      `SELECT m.id, m.user_id, m.kind, m.text, m.created_at, u.display_name FROM chat_messages m LEFT JOIN users u ON u.id=m.user_id
       WHERE m.dancer_id=$1 AND NOT m.hidden ORDER BY m.id DESC LIMIT 40`, [id]);
    const me = req.auth && !req.auth.guest ? req.auth.id : null;
    const following = me ? (await ctx.db.query('SELECT 1 FROM follows WHERE user_id=$1 AND dancer_id=$2', [me, id])).rows.length > 0 : false;
    const history = me ? (await ctx.db.query(
      `SELECT id, minutes, started_at, ended_at FROM bookings WHERE customer_id=$1 AND dancer_id=$2 AND status='ended' ORDER BY started_at DESC LIMIT 10`, [me, id])).rows : [];
    return {
      dancer: publicDancer(d),
      topFans: fans.rows.map((f) => ({ name: f.name, coins: Number(f.coins) })),
      chat: chat.rows.reverse().map((m) => ({ id: m.id, userId: m.user_id, user: m.display_name, kind: m.kind, text: m.text, at: m.created_at })),
      following,
      history,
    };
  });

  /** LiveKit token to watch the stage (subscribe only). */
  app.get('/stage/token', async (req) => {
    const u = requireAny(req);
    const studio = await getStudio(ctx.db);
    const token = await ctx.video.token({ room: stageRoom(studio.id), identity: u.id, name: u.guest ? 'Guest' : 'Viewer', publish: false, ttlSec: 4 * 3600 });
    return { url: ctx.video.url, room: stageRoom(studio.id), token };
  });

  // ---------- account
  app.get('/me', async (req) => {
    const { id } = requireUser(req);
    const u = (await ctx.db.query('SELECT id, phone, display_name, role, lang, vip_until, lifetime_spent, first_purchase_at FROM users WHERE id=$1', [id])).rows[0];
    if (!u) throw notFound('User not found');
    const wallet = await getWallet(ctx.db, id);
    const follows = (await ctx.db.query('SELECT dancer_id FROM follows WHERE user_id=$1', [id])).rows.map((r) => r.dancer_id);
    const spent = (await ctx.db.query(
      `SELECT dancer_id, sum(gross)::bigint AS coins FROM earnings WHERE customer_id=$1 GROUP BY dancer_id`, [id])).rows;
    const topFanOf = (await ctx.db.query(
      `SELECT dancer_id FROM (SELECT dancer_id, customer_id, rank() OVER (PARTITION BY dancer_id ORDER BY sum(gross) DESC) AS r
         FROM earnings WHERE customer_id IS NOT NULL GROUP BY dancer_id, customer_id) t WHERE customer_id=$1 AND r=1`, [id])).rows.map((r) => r.dancer_id);
    const history = (await ctx.db.query(
      `SELECT b.id, b.dancer_id, d.stage_name, b.minutes, b.started_at, b.end_reason, b.refunded FROM bookings b JOIN dancers d ON d.user_id=b.dancer_id
       WHERE b.customer_id=$1 AND b.status='ended' ORDER BY b.started_at DESC LIMIT 30`, [id])).rows;
    const open = (await ctx.db.query(`SELECT * FROM bookings WHERE customer_id=$1 AND status IN ('waitlisted','requested','active')`, [id])).rows[0] ?? null;
    return {
      user: { id: u.id, phone: u.phone, displayName: u.display_name, role: u.role, lang: u.lang, vipUntil: u.vip_until, lifetimeSpent: Number(u.lifetime_spent), firstPurchaseDone: !!u.first_purchase_at },
      wallet, follows, spent: Object.fromEntries(spent.map((s) => [s.dancer_id, Number(s.coins)])), topFanOf, history,
      openBooking: open && { id: open.id, dancerId: open.dancer_id, status: open.status, minutes: open.minutes, endsAt: open.ends_at, decideBy: open.decide_by },
    };
  });

  app.patch('/me', async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ lang: z.string().max(5).optional() }).parse(req.body);
    if (b.lang) await ctx.db.query('UPDATE users SET lang=$2 WHERE id=$1', [id, b.lang]);
    return { ok: true };
  });

  app.get('/wallet', async (req) => {
    const { id } = requireUser(req);
    const w = await getWallet(ctx.db, id);
    const entries = await ctx.db.query('SELECT id, delta, balance_after, kind, ref_type, meta, created_at FROM ledger_entries WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [id]);
    return { ...w, entries: entries.rows };
  });

  app.post('/push/token', async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ token: z.string().min(10).max(300), platform: z.enum(['android', 'ios']).default('android') }).parse(req.body);
    await ctx.db.query(`INSERT INTO push_tokens(token, user_id, platform) VALUES ($1,$2,$3)
      ON CONFLICT (token) DO UPDATE SET user_id=$2, updated_at=now()`, [b.token, id, b.platform]);
    return { ok: true };
  });

  app.get('/notifications', async (req) => {
    const { id } = requireUser(req);
    const r = await ctx.db.query('SELECT id, dancer_id, text, read_at, created_at FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [id]);
    return { items: r.rows };
  });
  app.post('/notifications/read', async (req) => {
    const { id } = requireUser(req);
    await ctx.db.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [id]);
    return { ok: true };
  });

  app.get('/leaderboard', async (req) => {
    requireAny(req);
    const spenders = await ctx.db.query(
      `SELECT u.id, u.display_name, sum(e.gross)::bigint AS coins FROM earnings e JOIN users u ON u.id=e.customer_id
       WHERE e.created_at > now() - interval '30 days' GROUP BY u.id ORDER BY coins DESC LIMIT 20`);
    const dancers = await ctx.db.query(`SELECT user_id AS id, stage_name AS name, coins_earned AS coins FROM dancers WHERE kyc_status='approved' ORDER BY coins_earned DESC LIMIT 20`);
    return {
      spenders: spenders.rows.map((r) => ({ id: r.id, name: r.display_name, coins: Number(r.coins) })),
      dancers: dancers.rows.map((r) => ({ ...r, coins: Number(r.coins) })),
    };
  });

  // ---------- engage
  app.post('/dancers/:id/follow', async (req) => {
    const { id: me } = requireUser(req);
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { follow } = z.object({ follow: z.boolean() }).parse(req.body);
    return toggleFollow(ctx, me, id, follow);
  });

  app.post('/gifts', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ dancerId: Uuid, giftId: z.string().max(40), idemKey: Idem }).parse(req.body);
    return sendGift(ctx, id, b.dancerId, b.giftId, b.idemKey);
  });

  app.post('/shoutouts', async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ dancerId: Uuid, idemKey: Idem }).parse(req.body);
    return shoutOut(ctx, id, b.dancerId, b.idemKey);
  });

  app.post('/songs/request', async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ dancerId: Uuid, songId: z.string().max(40), idemKey: Idem }).parse(req.body);
    return requestSong(ctx, id, b.dancerId, b.songId, b.idemKey);
  });

  app.post('/chat', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ dancerId: Uuid.nullable().default(null), text: z.string().min(1).max(500) }).parse(req.body);
    return sendChat(ctx, id, b.dancerId, b.text);
  });

  app.post('/packages', async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ idemKey: Idem }).parse(req.body);
    return buyRoomPackage(ctx, id, b.idemKey);
  });

  app.post('/reports', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ bookingId: Uuid.optional(), targetUserId: Uuid.optional(), reason: z.string().min(3).max(500) }).parse(req.body);
    return report(ctx, id, b);
  });

  // ---------- private rooms
  app.post('/bookings', async (req) => {
    const { id } = requireUser(req);
    const b = z.object({ dancerId: Uuid, minutes: z.union([z.literal(5), z.literal(15)]), useCredit: z.boolean().default(false) }).parse(req.body);
    return requestBooking(ctx, id, b.dancerId, b.minutes, b.useCredit);
  });
  app.post('/bookings/:id/cancel', async (req) => {
    const u = requireUser(req);
    return cancelBooking(ctx, u.id, z.object({ id: Uuid }).parse(req.params).id);
  });
  app.post('/bookings/:id/extend', async (req) => {
    const u = requireUser(req);
    return extendBooking(ctx, u.id, z.object({ id: Uuid }).parse(req.params).id);
  });
  app.post('/bookings/:id/end', async (req) => {
    const u = requireUser(req);
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const b = (await ctx.db.query('SELECT customer_id, dancer_id FROM bookings WHERE id=$1', [id])).rows[0];
    if (!b) throw notFound('Booking not found');
    if (b.customer_id === u.id) return endBooking(ctx, id, 'customer', u);
    if (b.dancer_id === u.id) return endBooking(ctx, id, 'dancer', u);
    throw forbidden();
  });
  app.post('/bookings/:id/rate', async (req) => {
    const u = requireUser(req);
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { stars } = z.object({ stars: z.number().int().min(1).max(5) }).parse(req.body);
    await ctx.db.query(`INSERT INTO audit_log(actor_id, action, target, meta) VALUES ($1,'booking.rate',$2,$3)`, [u.id, id, JSON.stringify({ stars })]);
    return { ok: true };
  });

  /** LiveKit token for the private room (customer or dancer of an active booking). */
  app.get('/bookings/:id/token', async (req) => {
    const u = requireUser(req);
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const b = (await ctx.db.query('SELECT * FROM bookings WHERE id=$1', [id])).rows[0];
    if (!b) throw notFound('Booking not found');
    if (b.customer_id !== u.id && b.dancer_id !== u.id) throw forbidden();
    if (b.status !== 'active') throw conflict('not_active', 'This room is not active');
    const name = (await ctx.db.query('SELECT display_name FROM users WHERE id=$1', [u.id])).rows[0].display_name;
    const ttl = Math.max(60, Math.ceil((new Date(b.ends_at).getTime() - ctx.now().getTime()) / 1000) + 600);
    const token = await ctx.video.token({ room: b.room_name, identity: u.id, name, publish: true, ttlSec: ttl });
    return { url: ctx.video.url, room: b.room_name, token, endsAt: b.ends_at };
  });
}
