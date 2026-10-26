// Buying coins and VIP.
//  - APK build  (APP_CHANNEL=apk):  Razorpay checkout (UPI, cards, wallets)
//  - Play build (APP_CHANNEL=play): Google Play Billing, as Play policy requires for digital goods
// The server verifies every payment before any coins are credited.
import { api, ApiError, CHANNEL } from './api';
import { VIP } from './data';

export async function buyProduct(productId, type) {
  if (CHANNEL === 'play') return buyWithPlay(productId === 'vip' ? VIP.playSubscriptionId : productId, type);
  return buyWithRazorpay(productId === 'vip' ? VIP.id : productId);
}

async function buyWithRazorpay(productId) {
  const RazorpayCheckout = require('react-native-razorpay').default;
  const order = await api('POST', '/payments/razorpay/order', { productId });
  let res;
  try {
    res = await RazorpayCheckout.open({
      key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: 'Mehfil Live', description: productId === VIP.id ? 'VIP — 30 days' : 'Coins', theme: { color: '#ff6b9d' },
    });
  } catch (e) {
    const cancelled = e && (e.code === 0 || e.code === 2 || /cancel/i.test(String(e.description || '')));
    throw new ApiError(400, cancelled ? 'cancelled' : 'payment_failed', cancelled ? 'Payment cancelled' : 'Payment failed — no money was taken');
  }
  return api('POST', '/payments/razorpay/verify', { orderId: res.razorpay_order_id, paymentId: res.razorpay_payment_id, signature: res.razorpay_signature });
}

let iapReady = false;
async function iap() {
  const IAP = require('expo-iap');
  if (!iapReady) { await IAP.initConnection(); iapReady = true; }
  return IAP;
}

function buyWithPlay(sku, type) {
  return new Promise((resolve, reject) => {
    (async () => {
      const IAP = await iap();
      const subs = [];
      const cleanup = () => subs.forEach((s) => s.remove());
      subs.push(IAP.purchaseUpdatedListener(async (p) => {
        if (p.productId !== sku) return;
        cleanup();
        try {
          resolve(await api('POST', '/payments/play/verify', { productId: sku, purchaseToken: p.purchaseToken ?? p.purchaseTokenAndroid, type }));
        } catch (e) { reject(e); }
      }));
      subs.push(IAP.purchaseErrorListener((e) => {
        cleanup();
        reject(new ApiError(400, 'cancelled', /cancel/i.test(String(e.code)) ? 'Payment cancelled' : e.message || 'Payment failed'));
      }));
      try {
        if (type === 'subs') {
          const prods = await IAP.fetchProducts({ skus: [sku], type: 'subs' });
          const offer = prods?.[0]?.subscriptionOffers?.find((o) => o.offerTokenAndroid);
          await IAP.requestPurchase({ type: 'subs', request: { google: { skus: [sku], subscriptionOffers: offer ? [{ sku, offerToken: offer.offerTokenAndroid }] : [] } } });
        } else {
          await IAP.fetchProducts({ skus: [sku], type: 'in-app' });
          await IAP.requestPurchase({ type: 'in-app', request: { google: { skus: [sku] } } });
        }
      } catch (e) { cleanup(); reject(e); }
    })().catch(reject);
  });
}

/** Play build: credit any purchase that completed while the app was closed. */
export async function restorePlayPurchases() {
  if (CHANNEL !== 'play') return;
  const IAP = await iap();
  const list = (await IAP.getAvailablePurchases()) || [];
  for (const p of list) {
    const type = p.productId === VIP.playSubscriptionId ? 'subs' : 'inapp';
    await api('POST', '/payments/play/verify', { productId: p.productId, purchaseToken: p.purchaseToken ?? p.purchaseTokenAndroid, type }).catch(() => {});
  }
}
