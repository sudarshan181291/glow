import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { COIN_PACKS, VIP_PRODUCT } from '../config.js';
import type { Ctx } from '../ctx.js';
import { withTx } from '../db/pool.js';
import { requireUser } from '../lib/auth.js';
import { safeEqual } from '../lib/crypto.js';
import { AppError, bad, forbidden, notFound } from '../lib/errors.js';
import { fulfilPayment, productInfo } from '../services/payments/credit.js';

const unavailable = (what: string) => new AppError(503, 'payments_unavailable', `${what} is not configured`);

export function paymentRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get('/payments/packs', async () => ({
    coins: COIN_PACKS.map((p) => ({ id: p.id, coins: p.coins, pricePaise: p.pricePaise })),
    vip: { id: VIP_PRODUCT.id, playSubscriptionId: VIP_PRODUCT.playSubscriptionId, pricePaise: VIP_PRODUCT.pricePaise, days: VIP_PRODUCT.days },
    razorpayKeyId: ctx.razorpay?.keyId ?? null,
  }));

  // ---------- Razorpay (APK build)
  app.post('/payments/razorpay/order', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req) => {
    const { id } = requireUser(req);
    if (!ctx.razorpay) throw unavailable('Razorpay');
    const { productId } = z.object({ productId: z.string() }).parse(req.body);
    const info = productInfo(productId);
    const pay = (await ctx.db.query(
      `INSERT INTO payments(user_id, provider, product_id, external_id, amount_paise, coins) VALUES ($1,'razorpay',$2,$3,$4,$5) RETURNING id`,
      [id, productId, `pending-${crypto.randomUUID()}`, info.pricePaise, info.coins])).rows[0];
    const order = await ctx.razorpay.createOrder(info.pricePaise, pay.id, { userId: id, productId, paymentId: pay.id });
    await ctx.db.query('UPDATE payments SET external_id=$2 WHERE id=$1', [pay.id, order.id]);
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: ctx.razorpay.keyId };
  });

  app.post('/payments/razorpay/verify', async (req) => {
    const { id } = requireUser(req);
    if (!ctx.razorpay) throw unavailable('Razorpay');
    const b = z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(req.body);
    if (!ctx.razorpay.verifyCheckout(b.orderId, b.paymentId, b.signature)) throw bad('bad_signature', 'Payment could not be verified');
    return withTx(ctx.db, async (tx) => {
      const p = (await tx.query('SELECT id, user_id FROM payments WHERE external_id=$1 FOR UPDATE', [b.orderId])).rows[0];
      if (!p) throw notFound('Order not found');
      if (p.user_id !== id) throw forbidden();
      await tx.query('UPDATE payments SET external_payment_id=$2 WHERE id=$1', [p.id, b.paymentId]);
      const r = await fulfilPayment(ctx, tx, p.id);
      return { ok: true, already: r.already };
    });
  });

  // Razorpay webhook: payment.captured / order.paid. Configure in Razorpay Dashboard → Webhooks.
  app.post('/webhooks/razorpay', { config: { rawBody: true } }, async (req, reply) => {
    if (!ctx.razorpay) throw unavailable('Razorpay');
    const sig = String(req.headers['x-razorpay-signature'] ?? '');
    const raw = (req as unknown as { rawBody: string }).rawBody;
    if (!sig || !ctx.razorpay.verifyWebhook(raw, sig)) return reply.code(400).send({ error: 'bad signature' });
    const evt = JSON.parse(raw) as { event: string; payload: { payment?: { entity: { id: string; order_id: string } }; order?: { entity: { id: string } } } };
    const orderId = evt.payload.payment?.entity.order_id ?? evt.payload.order?.entity.id;
    if ((evt.event === 'payment.captured' || evt.event === 'order.paid') && orderId) {
      await withTx(ctx.db, async (tx) => {
        const p = (await tx.query('SELECT id FROM payments WHERE external_id=$1 FOR UPDATE', [orderId])).rows[0];
        if (!p) return;
        if (evt.payload.payment) await tx.query('UPDATE payments SET external_payment_id=$2, raw=$3 WHERE id=$1', [p.id, evt.payload.payment.entity.id, raw]);
        await fulfilPayment(ctx, tx, p.id);
      });
    }
    if (evt.event === 'payment.failed' && orderId) {
      await ctx.db.query(`UPDATE payments SET status='failed' WHERE external_id=$1 AND status='created'`, [orderId]);
    }
    return { ok: true };
  });

  // ---------- Google Play Billing (Play Store build)
  app.post('/payments/play/verify', async (req) => {
    const { id } = requireUser(req);
    if (!ctx.play) throw unavailable('Google Play Billing');
    const b = z.object({ productId: z.string(), purchaseToken: z.string().min(10), type: z.enum(['inapp', 'subs']) }).parse(req.body);
    const info = productInfo(b.productId);
    if (b.type === 'inapp') {
      const pr = await ctx.play.getProduct(b.productId, b.purchaseToken);
      if (pr.purchaseState !== 0) throw bad('not_purchased', 'Purchase is not complete');
      const out = await withTx(ctx.db, async (tx) => {
        const ins = await tx.query(
          `INSERT INTO payments(user_id, provider, product_id, external_id, external_payment_id, amount_paise, coins)
           VALUES ($1,'play',$2,$3,$4,$5,$6) ON CONFLICT (external_id) DO NOTHING RETURNING id`,
          [id, b.productId, b.purchaseToken, pr.orderId ?? null, info.pricePaise, info.coins]);
        const pid = ins.rows[0]?.id ?? (await tx.query('SELECT id, user_id FROM payments WHERE external_id=$1', [b.purchaseToken])).rows[0].id;
        const owner = (await tx.query('SELECT user_id FROM payments WHERE id=$1', [pid])).rows[0].user_id;
        if (owner !== id) throw forbidden('This purchase belongs to another account');
        return fulfilPayment(ctx, tx, pid);
      });
      await ctx.play.consumeProduct(b.productId, b.purchaseToken).catch((e) => ctx.log.warn(e, 'play consume failed'));
      return { ok: true, already: out.already };
    }
    // Subscription (VIP)
    const sub = await ctx.play.getSubscription(b.purchaseToken);
    const line = sub.lineItems?.[0];
    if (!line || !['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(sub.subscriptionState)) throw bad('not_active', 'Subscription is not active');
    const until = new Date(line.expiryTime);
    await withTx(ctx.db, async (tx) => {
      const ext = `${b.purchaseToken}:${sub.latestOrderId ?? line.expiryTime}`;
      const ins = await tx.query(
        `INSERT INTO payments(user_id, provider, product_id, external_id, amount_paise) VALUES ($1,'play',$2,$3,$4)
         ON CONFLICT (external_id) DO NOTHING RETURNING id`, [id, b.productId, ext, info.pricePaise]);
      if (ins.rows[0]) await fulfilPayment(ctx, tx, ins.rows[0].id, { vipUntil: until });
      else await tx.query('UPDATE users SET vip_until=GREATEST(vip_until, $2) WHERE id=$1', [id, until]);
    });
    if (sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
      await ctx.play.acknowledgeSubscription(b.productId, b.purchaseToken).catch((e) => ctx.log.warn(e, 'play ack failed'));
    }
    return { ok: true, vipUntil: until };
  });

  // Google Play Real-time Developer Notifications (Pub/Sub push). Push URL: /webhooks/play?token=PLAY_RTDN_TOKEN
  app.post('/webhooks/play', async (req, reply) => {
    const token = String((req.query as Record<string, string>).token ?? '');
    if (!ctx.env.PLAY_RTDN_TOKEN || !safeEqual(token, ctx.env.PLAY_RTDN_TOKEN)) return reply.code(401).send({ error: 'unauthorised' });
    if (!ctx.play) return { ok: true };
    const body = req.body as { message?: { data?: string } };
    const data = body.message?.data ? JSON.parse(Buffer.from(body.message.data, 'base64').toString()) : {};
    const s = data.subscriptionNotification as { purchaseToken: string; subscriptionId: string } | undefined;
    if (s) {
      const sub = await ctx.play.getSubscription(s.purchaseToken);
      const exp = sub.lineItems?.[0]?.expiryTime;
      if (exp) {
        await ctx.db.query(
          `UPDATE users SET vip_until=$2 WHERE id = (SELECT user_id FROM payments WHERE external_id LIKE $1 || ':%' ORDER BY created_at LIMIT 1)`,
          [s.purchaseToken, new Date(exp)]);
      }
    }
    const v = data.voidedPurchaseNotification as { purchaseToken: string } | undefined;
    if (v) await ctx.db.query(`UPDATE payments SET status='refunded' WHERE external_id=$1`, [v.purchaseToken]);
    return { ok: true };
  });

  // ---------- LiveKit webhook: camera on/off for dancers, room disconnects.
  app.post('/webhooks/livekit', { config: { rawBody: true } }, async (req, reply) => {
    const raw = (req as unknown as { rawBody: string }).rawBody;
    let evt;
    try { evt = await ctx.video.receiveWebhook(raw, req.headers.authorization); } catch { return reply.code(401).send({ error: 'bad signature' }); }
    const room = evt.room?.name ?? '';
    const who = evt.participant?.identity;
    if (room.startsWith('stage-') && who && (evt.event === 'track_published' || evt.event === 'participant_left')) {
      const live = evt.event === 'track_published';
      await ctx.db.query('UPDATE dancers SET camera_live=$2 WHERE user_id::text=$1', [who, live]);
      const d = (await ctx.db.query('SELECT user_id FROM dancers WHERE user_id::text=$1', [who])).rows[0];
      if (d) await ctx.rt.publish(ctx.db, { type: 'camera', data: { dancerId: d.user_id, live } });
    }
    // If the dancer drops out of a private room for more than 60 s, the engine ends it with a refund.
    // A customer dropping out can rejoin until time runs out.
    if (room.startsWith('room-') && who && (evt.event === 'participant_left' || evt.event === 'participant_joined')) {
      await ctx.db.query(
        `UPDATE bookings SET dancer_left_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE id::text=$1 AND dancer_id::text=$2 AND status='active'`,
        [room.slice(5), who, evt.event === 'participant_left']);
    }
    return { ok: true };
  });
}
