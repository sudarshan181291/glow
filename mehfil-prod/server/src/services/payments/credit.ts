// Credits a paid purchase exactly once, whichever path reports it first
// (app verify call, Razorpay webhook, Google Play RTDN).
import { COIN_PACKS, VIP_PRODUCT } from '../../config.js';
import type { Ctx } from '../../ctx.js';
import type { Tx } from '../../db/pool.js';
import { bad } from '../../lib/errors.js';
import { applyLedger } from '../ledger.js';
import { getStudio } from '../studio.js';

export function productInfo(productId: string) {
  const pack = COIN_PACKS.find((p) => p.id === productId);
  if (pack) return { kind: 'coins' as const, coins: pack.coins, pricePaise: pack.pricePaise };
  if (productId === VIP_PRODUCT.id || productId === VIP_PRODUCT.playSubscriptionId) return { kind: 'vip' as const, coins: 0, pricePaise: VIP_PRODUCT.pricePaise };
  throw bad('unknown_product', 'Unknown product');
}

/** GST included in an Indian price: 18/118 of the amount. */
export const gstOf = (amountPaise: number) => Math.round((amountPaise * 18) / 118);

export async function fulfilPayment(ctx: Ctx, tx: Tx, paymentId: string, opts: { vipUntil?: Date } = {}) {
  const p = (await tx.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [paymentId])).rows[0];
  if (!p) throw new Error('payment not found');
  if (p.status === 'paid') return { already: true };
  const info = productInfo(p.product_id);
  await tx.query(`UPDATE payments SET status='paid', paid_at=now(), gst_paise=$2 WHERE id=$1`, [p.id, gstOf(p.amount_paise)]);
  if (info.kind === 'coins') {
    await applyLedger(tx, p.user_id, info.coins, 'purchase', { refType: 'payment', refId: p.id, idemKey: `payment:${p.id}`, meta: { provider: p.provider, product: p.product_id } });
    const u = (await tx.query('SELECT first_purchase_at FROM users WHERE id=$1 FOR UPDATE', [p.user_id])).rows[0];
    if (!u.first_purchase_at) {
      const { config } = await getStudio(tx);
      await tx.query('UPDATE users SET first_purchase_at=now() WHERE id=$1', [p.user_id]);
      await applyLedger(tx, p.user_id, config.firstBonus, 'bonus', { idemKey: `first-bonus:${p.user_id}` });
    }
  } else {
    const until = opts.vipUntil
      ?? new Date(Math.max(Date.now(), new Date((await tx.query('SELECT vip_until FROM users WHERE id=$1', [p.user_id])).rows[0].vip_until ?? 0).getTime()) + VIP_PRODUCT.days * 864e5);
    await tx.query('UPDATE users SET vip_until=$2 WHERE id=$1', [p.user_id, until]);
  }
  await ctx.rt.publish(tx, { type: 'wallet_changed', to: p.user_id, data: {} });
  return { already: false };
}
