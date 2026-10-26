// Dancer, floor manager, moderator and admin endpoints.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DEFAULT_STUDIO_CONFIG } from '../config.js';
import type { Ctx } from '../ctx.js';
import { withTx } from '../db/pool.js';
import { requireRole } from '../lib/auth.js';
import { bad, conflict, notFound } from '../lib/errors.js';
import {
  announce, blockCustomer, floorSetStatus, killAllRooms, messageFollowers, setAvailability, stagePublishToken,
} from '../services/actions.js';
import { acceptBooking, declineBooking, endBooking } from '../services/engine.js';
import { audit, DANCER_COLS, emitDancer, getStudio, publicDancer } from '../services/studio.js';
import { normalisePhone } from './auth.js';

const Uuid = z.string().uuid();

export function staffRoutes(app: FastifyInstance, ctx: Ctx) {
  // ================================================================ dancer
  app.get('/dancer/me', async (req) => {
    const u = requireRole(req, 'dancer');
    const d = (await ctx.db.query(`SELECT ${DANCER_COLS} FROM dancers d WHERE d.user_id=$1`, [u.id])).rows[0];
    if (!d) throw notFound('No dancer profile yet — ask the studio to set you up');
    const unpaid = (await ctx.db.query('SELECT coalesce(sum(dancer_share),0)::bigint AS s FROM earnings WHERE dancer_id=$1 AND payout_id IS NULL', [u.id])).rows[0].s;
    const today = (await ctx.db.query(`SELECT coalesce(sum(gross),0)::bigint AS s FROM earnings WHERE dancer_id=$1 AND created_at > date_trunc('day', now())`, [u.id])).rows[0].s;
    const fans = await ctx.db.query(
      `SELECT u.id, u.display_name AS name, sum(e.gross)::bigint AS coins FROM earnings e JOIN users u ON u.id=e.customer_id
       WHERE e.dancer_id=$1 GROUP BY u.id ORDER BY coins DESC LIMIT 10`, [u.id]);
    const pending = await ctx.db.query(
      `SELECT b.*, u.display_name FROM bookings b JOIN users u ON u.id=b.customer_id WHERE b.dancer_id=$1 AND b.status IN ('requested','active')`, [u.id]);
    const blocked = await ctx.db.query('SELECT b.customer_id, u.display_name FROM blocks b JOIN users u ON u.id=b.customer_id WHERE b.dancer_id=$1', [u.id]);
    const { config } = await getStudio(ctx.db);
    return {
      dancer: { ...publicDancer(d), split: d.split_pct, kycStatus: d.kyc_status },
      earnings: { unpaidShare: Number(unpaid), unpaidRupees: Math.floor((Number(unpaid) * config.coinValuePaise) / 100), todayGross: Number(today) },
      topFans: fans.rows.map((f) => ({ id: f.id, name: f.name, coins: Number(f.coins) })),
      bookings: pending.rows.map((b) => ({ id: b.id, customer: b.display_name, customerId: b.customer_id, minutes: b.minutes, price: b.price, status: b.status, decideBy: b.decide_by, endsAt: b.ends_at })),
      blocked: blocked.rows.map((b) => ({ id: b.customer_id, name: b.display_name })),
    };
  });

  app.patch('/dancer/me', async (req) => {
    const u = requireRole(req, 'dancer');
    const b = z.object({
      bio: z.string().max(400).optional(), langs: z.array(z.string().max(20)).max(6).optional(), specs: z.array(z.string().max(30)).max(6).optional(),
      city: z.string().max(40).optional(), photoUrl: z.string().url().optional(), videoUrl: z.string().url().optional(),
    }).parse(req.body);
    await ctx.db.query(
      `UPDATE dancers SET bio=coalesce($2,bio), langs=coalesce($3,langs), specs=coalesce($4,specs), city=coalesce($5,city),
       photo_url=coalesce($6,photo_url), video_url=coalesce($7,video_url) WHERE user_id=$1`,
      [u.id, b.bio ?? null, b.langs ?? null, b.specs ?? null, b.city ?? null, b.photoUrl ?? null, b.videoUrl ?? null]);
    await emitDancer(ctx, ctx.db, u.id);
    return { ok: true };
  });

  app.post('/dancer/availability', async (req) => {
    const u = requireRole(req, 'dancer');
    const { mode } = z.object({ mode: z.enum(['available', 'busy', 'break', 'off']) }).parse(req.body);
    return setAvailability(ctx, u.id, mode);
  });

  app.get('/dancer/stage-token', async (req) => stagePublishToken(ctx, requireRole(req, 'dancer').id));

  app.post('/dancer/bookings/:id/accept', async (req) => acceptBooking(ctx, requireRole(req, 'dancer').id, z.object({ id: Uuid }).parse(req.params).id));
  app.post('/dancer/bookings/:id/decline', async (req) => declineBooking(ctx, requireRole(req, 'dancer').id, z.object({ id: Uuid }).parse(req.params).id));

  app.get('/dancer/ledger', async (req) => {
    const u = requireRole(req, 'dancer');
    const r = await ctx.db.query(
      `SELECT e.id, e.kind, e.gross, e.dancer_share, e.created_at, e.payout_id, u.display_name FROM earnings e LEFT JOIN users u ON u.id=e.customer_id
       WHERE e.dancer_id=$1 ORDER BY e.id DESC LIMIT 100`, [u.id]);
    return { items: r.rows.map((x) => ({ ...x, gross: Number(x.gross), dancer_share: Number(x.dancer_share) })) };
  });

  app.post('/dancer/message-followers', async (req) => {
    const u = requireRole(req, 'dancer');
    const { text } = z.object({ text: z.string().min(1).max(140) }).parse(req.body);
    return messageFollowers(ctx, u.id, text);
  });

  app.post('/dancer/block', async (req) => {
    const u = requireRole(req, 'dancer');
    const b = z.object({ customerId: Uuid, block: z.boolean() }).parse(req.body);
    return blockCustomer(ctx, u.id, b.customerId, b.block);
  });

  // ================================================================ floor manager
  app.get('/floor/overview', async (req) => {
    requireRole(req, 'floor', 'moderator');
    const studio = await getStudio(ctx.db);
    const counts = await ctx.db.query(`SELECT status, count(*)::int AS n FROM dancers WHERE studio_id=$1 GROUP BY status`, [studio.id]);
    const roster = await ctx.db.query(`SELECT ${DANCER_COLS} FROM dancers d WHERE d.studio_id=$1 ORDER BY d.stage_name`, [studio.id]);
    const rooms = await ctx.db.query(
      `SELECT b.id, b.dancer_id, d.stage_name, u.display_name AS customer, b.started_at, b.ends_at FROM bookings b
       JOIN dancers d ON d.user_id=b.dancer_id JOIN users u ON u.id=b.customer_id WHERE b.studio_id=$1 AND b.status='active'`, [studio.id]);
    const today = await ctx.db.query(
      `SELECT coalesce(sum(gross),0)::bigint AS gross, coalesce(sum(dancer_share),0)::bigint AS share,
              coalesce(sum(CASE WHEN kind='refund' THEN -gross ELSE 0 END),0)::bigint AS refunds
       FROM earnings WHERE created_at > date_trunc('day', now())`);
    const waitlist = (await ctx.db.query(`SELECT count(*)::int AS n FROM bookings WHERE studio_id=$1 AND status='waitlisted'`, [studio.id])).rows[0].n;
    const reports = (await ctx.db.query(`SELECT count(*)::int AS n FROM reports WHERE status='open'`)).rows[0].n;
    const t = today.rows[0];
    return {
      config: studio.config,
      counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
      roster: roster.rows.map((r) => ({ ...publicDancer(r), split: r.split_pct, kycStatus: r.kyc_status })),
      rooms: rooms.rows,
      today: { gross: Number(t.gross), dancerShare: Number(t.share), platform: Number(t.gross) - Number(t.share), refunds: Number(t.refunds) },
      waitlist, openReports: reports,
    };
  });

  app.post('/floor/dancers/:id/status', async (req) => {
    const u = requireRole(req, 'floor');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { status } = z.object({ status: z.enum(['stage', 'bench', 'break', 'off']) }).parse(req.body);
    return floorSetStatus(ctx, u.id, id, status);
  });

  app.post('/floor/dancers/:id/split', async (req) => {
    const u = requireRole(req, 'floor');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { split } = z.object({ split: z.number().int().min(0).max(100) }).parse(req.body);
    await ctx.db.query('UPDATE dancers SET split_pct=$2 WHERE user_id=$1', [id, split]);
    await audit(ctx.db, u.id, 'floor.split', id, { split });
    return { ok: true };
  });

  app.post('/floor/rooms/:id/end', async (req) => {
    const u = requireRole(req, 'floor', 'moderator');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const out = await endBooking(ctx, id, 'floor');
    await audit(ctx.db, u.id, 'floor.end_room', id);
    return out;
  });

  app.post('/floor/kill', async (req) => killAllRooms(ctx, requireRole(req, 'floor', 'moderator').id));

  app.post('/floor/announce', async (req) => {
    const u = requireRole(req, 'floor');
    const { text } = z.object({ text: z.string().min(1).max(200) }).parse(req.body);
    return announce(ctx, u.id, text);
  });

  app.patch('/floor/config', async (req) => {
    const u = requireRole(req, 'floor');
    const keys = Object.keys(DEFAULT_STUDIO_CONFIG) as (keyof typeof DEFAULT_STUDIO_CONFIG)[];
    const shape = Object.fromEntries(keys.map((k) => [k, z.number().int().min(0).max(1_000_000).optional()]));
    const patch = z.object(shape).strict().parse(req.body) as Record<string, number | undefined>;
    const studio = await getStudio(ctx.db);
    const next = { ...studio.config, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    if (next.minStage > next.stageCap) throw bad('bad_config', 'Minimum stage cannot exceed stage slots');
    if (next.defaultSplit > 100) throw bad('bad_config', 'Split must be 0–100');
    await ctx.db.query('UPDATE studios SET config=$2 WHERE id=$1', [studio.id, JSON.stringify(next)]);
    await audit(ctx.db, u.id, 'floor.config', studio.id, patch);
    const { coinValuePaise, ...pub } = next;
    await ctx.rt.publish(ctx.db, { type: 'config', data: pub });
    return { config: next };
  });

  // ================================================================ moderation
  app.get('/mod/reports', async (req) => {
    requireRole(req, 'moderator', 'floor');
    const r = await ctx.db.query(
      `SELECT r.*, a.display_name AS reporter, t.display_name AS target FROM reports r JOIN users a ON a.id=r.reporter_id
       LEFT JOIN users t ON t.id=r.target_user_id ORDER BY (r.status='open') DESC, r.created_at DESC LIMIT 100`);
    return { items: r.rows };
  });

  app.post('/mod/reports/:id/resolve', async (req) => {
    const u = requireRole(req, 'moderator', 'floor');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { resolution } = z.object({ resolution: z.string().max(300).default('reviewed') }).parse(req.body ?? {});
    await ctx.db.query(`UPDATE reports SET status='resolved', resolved_by=$2, resolved_at=now(), resolution=$3 WHERE id=$1`, [id, u.id, resolution]);
    await audit(ctx.db, u.id, 'mod.resolve', id, { resolution });
    return { ok: true };
  });

  /** Join any private room invisibly to check it. */
  app.get('/mod/rooms/:id/token', async (req) => {
    const u = requireRole(req, 'moderator', 'floor');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const b = (await ctx.db.query(`SELECT room_name, status FROM bookings WHERE id=$1`, [id])).rows[0];
    if (!b || b.status !== 'active') throw conflict('not_active', 'Room is not active');
    await audit(ctx.db, u.id, 'mod.join_room', id);
    return { url: ctx.video.url, room: b.room_name, token: await ctx.video.token({ room: b.room_name, identity: `mod-${u.id}`, name: 'Moderator', publish: false, hidden: true }) };
  });

  app.post('/mod/users/:id/ban', async (req) => {
    const u = requireRole(req, 'moderator');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { reason, ban } = z.object({ reason: z.string().max(300), ban: z.boolean().default(true) }).parse(req.body);
    await withTx(ctx.db, async (tx) => {
      await tx.query('UPDATE users SET banned_at=CASE WHEN $2 THEN now() ELSE NULL END, ban_reason=$3 WHERE id=$1', [id, ban, reason]);
      if (ban) {
        await tx.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [id]);
        await tx.query(`UPDATE bookings SET status='cancelled', ended_at=now(), end_reason='banned' WHERE customer_id=$1 AND status IN ('requested','waitlisted')`, [id]);
      }
      await audit(tx, u.id, ban ? 'mod.ban' : 'mod.unban', id, { reason });
    });
    if (ban) {
      const b = (await ctx.db.query(`SELECT id FROM bookings WHERE customer_id=$1 AND status='active'`, [id])).rows[0];
      if (b) await endBooking(ctx, b.id, 'floor');
    }
    return { ok: true };
  });

  app.post('/mod/chat/:id/hide', async (req) => {
    const u = requireRole(req, 'moderator', 'floor');
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    await ctx.db.query('UPDATE chat_messages SET hidden=true WHERE id=$1', [id]);
    await ctx.rt.publish(ctx.db, { type: 'chat_hidden', data: { id } });
    await audit(ctx.db, u.id, 'mod.hide_chat', String(id));
    return { ok: true };
  });

  // ================================================================ admin
  /** Make a user (by phone) a dancer and create her profile. She signs in with her own phone OTP. */
  app.post('/admin/dancers', async (req) => {
    const u = requireRole(req, 'admin');
    const b = z.object({
      phone: z.string(), stageName: z.string().min(2).max(30), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      bio: z.string().max(400).default(''), langs: z.array(z.string()).default([]), specs: z.array(z.string()).default([]), city: z.string().default(''),
    }).parse(req.body);
    const phone = normalisePhone(b.phone);
    const dob = new Date(`${b.dob}T00:00:00Z`);
    if (Date.now() - dob.getTime() < 18 * 365.25 * 864e5) throw bad('underage', 'Dancers must be 18 or older');
    return withTx(ctx.db, async (tx) => {
      const studio = await getStudio(tx);
      const user = (await tx.query(
        `INSERT INTO users(phone, display_name, role, dob, age_confirmed_at) VALUES ($1,$2,'dancer',$3,now())
         ON CONFLICT (phone) DO UPDATE SET role='dancer', dob=EXCLUDED.dob RETURNING id`, [phone, b.stageName, b.dob])).rows[0];
      await tx.query('INSERT INTO wallets(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
      await tx.query(
        `INSERT INTO dancers(user_id, studio_id, stage_name, bio, langs, specs, city, split_pct) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id) DO UPDATE SET stage_name=EXCLUDED.stage_name, bio=EXCLUDED.bio, langs=EXCLUDED.langs, specs=EXCLUDED.specs, city=EXCLUDED.city`,
        [user.id, studio.id, b.stageName, b.bio, b.langs, b.specs, b.city, studio.config.defaultSplit]);
      await audit(tx, u.id, 'admin.create_dancer', user.id);
      return { id: user.id };
    });
  });

  /** KYC decision (after checking ID and proof of age through your KYC provider). */
  app.post('/admin/dancers/:id/kyc', async (req) => {
    const u = requireRole(req, 'admin');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const b = z.object({ status: z.enum(['approved', 'rejected', 'pending']), reference: z.string().max(100).optional() }).parse(req.body);
    await ctx.db.query('UPDATE dancers SET kyc_status=$2, kyc_ref=coalesce($3,kyc_ref) WHERE user_id=$1', [id, b.status, b.reference ?? null]);
    await audit(ctx.db, u.id, 'admin.kyc', id, b);
    await emitDancer(ctx, ctx.db, id);
    return { ok: true };
  });

  app.post('/admin/users/role', async (req) => {
    const u = requireRole(req, 'admin');
    const b = z.object({ phone: z.string(), role: z.enum(['customer', 'floor', 'moderator', 'admin']) }).parse(req.body);
    const r = await ctx.db.query('UPDATE users SET role=$2 WHERE phone=$1 RETURNING id', [normalisePhone(b.phone), b.role]);
    if (!r.rows[0]) throw notFound('No user with that phone — they must sign in once first');
    await audit(ctx.db, u.id, 'admin.role', r.rows[0].id, { role: b.role });
    return { ok: true };
  });

  /** Weekly payouts: create payout records for every dancer above the threshold and return a CSV for the bank. */
  app.post('/admin/payouts/run', async (req, reply) => {
    const u = requireRole(req, 'admin');
    const { minRupees } = z.object({ minRupees: z.number().int().min(0).default(1000) }).parse(req.body ?? {});
    const { config } = await getStudio(ctx.db);
    const rows = await withTx(ctx.db, async (tx) => {
      const due = await tx.query(
        `SELECT e.dancer_id, d.stage_name, u.phone, sum(e.dancer_share)::bigint AS coins FROM earnings e
         JOIN dancers d ON d.user_id=e.dancer_id JOIN users u ON u.id=e.dancer_id
         WHERE e.payout_id IS NULL GROUP BY e.dancer_id, d.stage_name, u.phone`);
      const out: string[] = ['dancer_id,stage_name,phone,coins,amount_rupees,payout_id'];
      for (const r of due.rows) {
        const paise = Math.floor(Number(r.coins) * config.coinValuePaise);
        if (paise < minRupees * 100) continue;
        const p = (await tx.query('INSERT INTO payouts(dancer_id, coins, amount_paise) VALUES ($1,$2,$3) RETURNING id', [r.dancer_id, r.coins, paise])).rows[0];
        await tx.query('UPDATE earnings SET payout_id=$2 WHERE dancer_id=$1 AND payout_id IS NULL', [r.dancer_id, p.id]);
        out.push([r.dancer_id, JSON.stringify(r.stage_name), r.phone, r.coins, (paise / 100).toFixed(2), p.id].join(','));
      }
      await audit(tx, u.id, 'admin.payouts_run', null, { count: out.length - 1 });
      return out;
    });
    reply.header('content-type', 'text/csv');
    return rows.join('\n');
  });

  app.post('/admin/payouts/:id/paid', async (req) => {
    const u = requireRole(req, 'admin');
    const { id } = z.object({ id: Uuid }).parse(req.params);
    const { reference } = z.object({ reference: z.string().max(100) }).parse(req.body);
    await ctx.db.query(`UPDATE payouts SET status='paid', paid_at=now(), reference=$2 WHERE id=$1`, [id, reference]);
    await audit(ctx.db, u.id, 'admin.payout_paid', id, { reference });
    return { ok: true };
  });
}
