// Razorpay: create orders, verify checkout signatures and webhooks.
// Docs: https://razorpay.com/docs/payments/server-integration/
import { hmacHex, safeEqual } from '../../lib/crypto.js';

export interface RazorpayClient {
  keyId: string;
  createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<{ id: string; amount: number; currency: string }>;
  verifyCheckout(orderId: string, paymentId: string, signature: string): boolean;
  verifyWebhook(rawBody: string, signature: string): boolean;
}

export class Razorpay implements RazorpayClient {
  constructor(public keyId: string, private keySecret: string, private webhookSecret: string) {}

  async createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    });
    if (!res.ok) throw new Error(`Razorpay order failed ${res.status}: ${await res.text()}`);
    return (await res.json()) as { id: string; amount: number; currency: string };
  }

  verifyCheckout(orderId: string, paymentId: string, signature: string) {
    return safeEqual(hmacHex(this.keySecret, `${orderId}|${paymentId}`), signature);
  }

  verifyWebhook(rawBody: string, signature: string) {
    return safeEqual(hmacHex(this.webhookSecret, rawBody), signature);
  }
}
