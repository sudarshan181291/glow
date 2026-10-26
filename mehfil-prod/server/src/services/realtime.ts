// Real-time fan-out. Events are published with PostgreSQL NOTIFY, so:
//  - events sent inside a transaction are delivered only if it commits;
//  - every server instance LISTENs and forwards to its own WebSocket clients
//    (run as many instances as you like behind a load balancer).
import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';
import type { WebSocket } from 'ws';
import type { Db, Queryable } from '../db/pool.js';
import type { Role } from '../lib/auth.js';

export interface RtEvent {
  type: string;
  data: unknown;
  to?: string;        // a single user id
  roles?: Role[];     // only users with these roles (staff channels)
}

interface Client { ws: WebSocket; userId: string; role: Role; alive: boolean }

const CHANNEL = 'mehfil_events';

export class Realtime {
  private clients = new Set<Client>();
  private listener?: pg.PoolClient;
  private ping?: NodeJS.Timeout;

  constructor(private db: Db, private log: FastifyBaseLogger) {}

  async start() {
    this.listener = await this.db.connect();
    await this.listener.query(`LISTEN ${CHANNEL}`);
    this.listener.on('notification', (msg) => {
      if (!msg.payload) return;
      try { this.dispatch(JSON.parse(msg.payload)); } catch (e) { this.log.error(e, 'bad realtime payload'); }
    });
    this.listener.on('error', (e) => this.log.error(e, 'realtime listener error'));
    this.ping = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) { c.ws.terminate(); this.clients.delete(c); continue; }
        c.alive = false;
        try { c.ws.ping(); } catch { /* ignore */ }
      }
    }, 25000);
  }

  async stop() {
    if (this.ping) clearInterval(this.ping);
    for (const c of this.clients) c.ws.close();
    this.clients.clear();
    if (this.listener) { await this.listener.query(`UNLISTEN ${CHANNEL}`).catch(() => {}); this.listener.release(); }
  }

  /** Publish an event. Pass the transaction client to send it only on commit. */
  async publish(q: Queryable, evt: RtEvent) {
    const payload = JSON.stringify(evt);
    if (Buffer.byteLength(payload) > 7900) { this.log.warn({ type: evt.type }, 'realtime payload too large, dropped'); return; }
    await q.query('SELECT pg_notify($1, $2)', [CHANNEL, payload]);
  }

  add(ws: WebSocket, userId: string, role: Role) {
    const c: Client = { ws, userId, role, alive: true };
    this.clients.add(c);
    ws.on('pong', () => { c.alive = true; });
    ws.on('close', () => this.clients.delete(c));
    ws.on('error', () => this.clients.delete(c));
    return c;
  }

  private dispatch(evt: RtEvent) {
    const msg = JSON.stringify({ type: evt.type, data: evt.data });
    for (const c of this.clients) {
      if (evt.to && c.userId !== evt.to) continue;
      if (evt.roles && c.role !== 'admin' && !evt.roles.includes(c.role)) continue;
      if (c.ws.readyState === 1) c.ws.send(msg);
    }
  }

  get size() { return this.clients.size; }
}
