// Push notifications through Expo's push service (works with FCM on Android).
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/pool.js';

export interface PushService { send(userIds: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void> }

export class ExpoPush implements PushService {
  constructor(private db: Db, private log: FastifyBaseLogger, private accessToken?: string) {}

  async send(userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
    if (!userIds.length) return;
    const r = await this.db.query('SELECT token FROM push_tokens WHERE user_id = ANY($1::uuid[])', [userIds]);
    const tokens: string[] = r.rows.map((x) => x.token);
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100).map((to) => ({ to, title, body, data, sound: 'default', channelId: 'live' }));
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}) },
          body: JSON.stringify(batch),
        });
        const out = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
        // Remove tokens for uninstalled apps
        out.data?.forEach((t, k) => {
          if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
            this.db.query('DELETE FROM push_tokens WHERE token=$1', [batch[k].to]).catch(() => {});
          }
        });
      } catch (e) {
        this.log.warn(e, 'push send failed');
      }
    }
  }
}

/** Used in tests and when push is disabled. */
export class NoopPush implements PushService {
  sent: { userIds: string[]; title: string; body: string }[] = [];
  async send(userIds: string[], title: string, body: string) { this.sent.push({ userIds, title, body }); }
}
