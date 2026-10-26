import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { ZodError } from 'zod';
import type { Ctx } from './ctx.js';
import { bearer } from './lib/auth.js';
import { AppError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { customerRoutes, snapshot } from './routes/customer.js';
import { paymentRoutes } from './routes/payments.js';
import { staffRoutes } from './routes/staff.js';

export async function buildApp(ctx: Ctx, app: FastifyInstance): Promise<FastifyInstance> {
  // Keep the raw body (webhook signatures need it) and parse JSON ourselves.
  for (const type of ['application/json', 'application/webhook+json']) {
    app.addContentTypeParser(type, { parseAs: 'string', bodyLimit: 256 * 1024 }, (req, body, done) => {
      (req as unknown as { rawBody: string }).rawBody = body as string;
      try { done(null, body ? JSON.parse(body as string) : {}); } catch {
        const e = new AppError(400, 'bad_json', 'Invalid JSON body'); done(e, undefined);
      }
    });
  }

  await app.register(helmet, { global: true });
  await app.register(cors, { origin: ctx.env.CORS_ORIGINS ? ctx.env.CORS_ORIGINS.split(',') : false });
  await app.register(rateLimit, {
    global: true, max: 300, timeWindow: '1 minute', keyGenerator: (r) => r.auth?.id ?? r.ip,
    allowList: ctx.env.RATE_LIMIT_ALLOWLIST ? ctx.env.RATE_LIMIT_ALLOWLIST.split(',') : [],
  });
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });

  app.addHook('onRequest', async (req) => {
    const t = bearer(req);
    if (t) req.auth = await ctx.tokens.verify(t);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: err.code, message: err.message, ...err.extra });
    if (err instanceof ZodError) return reply.code(400).send({ error: 'invalid', message: err.issues[0]?.message ?? 'Invalid request', issues: err.issues });
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode === 429) return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests, slow down' });
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: 'bad_request', message: e.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'server_error', message: 'Something went wrong. Please try again.' });
  });

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/readyz', async () => { await ctx.db.query('SELECT 1'); return { ok: true, sockets: ctx.rt.size }; });

  // Real-time: ws(s)://host/ws?token=<access token>. Sends a snapshot, then live events.
  app.get('/ws', { websocket: true }, async (socket, req) => {
    const token = String((req.query as Record<string, string>).token ?? '');
    let user;
    try { user = await ctx.tokens.verify(token); } catch { socket.close(4401, 'unauthorised'); return; }
    ctx.rt.add(socket, user.id, user.role);
    socket.send(JSON.stringify({ type: 'snapshot', data: await snapshot(ctx, user.guest ? null : user.id) }));
    socket.on('message', (raw: Buffer) => { if (raw.toString() === 'ping') socket.send('{"type":"pong"}'); });
  });

  authRoutes(app, ctx);
  customerRoutes(app, ctx);
  paymentRoutes(app, ctx);
  staffRoutes(app, ctx);
  return app;
}

export function makeFastify(level: string) {
  return Fastify({
    logger: { level, redact: ['req.headers.authorization', 'body.code', 'body.refresh'] },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });
}
