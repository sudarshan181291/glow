// Google Play Billing: verify purchases with the Play Developer API using a service account.
// Docs: https://developer.android.com/google/play/billing/security#verify
import { GoogleAuth } from 'google-auth-library';

export interface PlayProduct { purchaseState: number; consumptionState?: number; orderId?: string; acknowledgementState?: number }
export interface PlaySubscription { subscriptionState: string; lineItems?: { productId: string; expiryTime: string }[]; latestOrderId?: string; acknowledgementState?: string }

export interface PlayVerifier {
  getProduct(productId: string, token: string): Promise<PlayProduct>;
  consumeProduct(productId: string, token: string): Promise<void>;
  getSubscription(token: string): Promise<PlaySubscription>;
  acknowledgeSubscription(subscriptionId: string, token: string): Promise<void>;
}

const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

export class GooglePlay implements PlayVerifier {
  private auth: GoogleAuth;
  constructor(private pkg: string, serviceAccountJson: string) {
    this.auth = new GoogleAuth({ credentials: JSON.parse(serviceAccountJson), scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  }
  private async call<T>(method: 'GET' | 'POST', path: string): Promise<T> {
    const client = await this.auth.getClient();
    const res = await client.request<T>({ url: `${BASE}/${this.pkg}/${path}`, method, data: method === 'POST' ? {} : undefined });
    return res.data;
  }
  getProduct(productId: string, token: string) { return this.call<PlayProduct>('GET', `purchases/products/${productId}/tokens/${token}`); }
  async consumeProduct(productId: string, token: string) { await this.call('POST', `purchases/products/${productId}/tokens/${token}:consume`); }
  getSubscription(token: string) { return this.call<PlaySubscription>('GET', `purchases/subscriptionsv2/tokens/${token}`); }
  async acknowledgeSubscription(subscriptionId: string, token: string) {
    await this.call('POST', `purchases/subscriptions/${subscriptionId}/tokens/${token}:acknowledge`);
  }
}
