import type { FastifyBaseLogger } from 'fastify';
import type { Env } from './config.js';
import type { Db } from './db/pool.js';
import type { Tokens } from './lib/auth.js';
import type { OtpSender } from './services/otp.js';
import type { PushService } from './services/push.js';
import type { Realtime } from './services/realtime.js';
import type { VideoService } from './services/video.js';
import type { RazorpayClient } from './services/payments/razorpay.js';
import type { PlayVerifier } from './services/payments/play.js';

/** Everything a route or service needs. Built once in app.ts; swapped with fakes in tests. */
export interface Ctx {
  env: Env;
  db: Db;
  log: FastifyBaseLogger;
  rt: Realtime;
  video: VideoService;
  otp: OtpSender;
  push: PushService;
  tokens: Tokens;
  razorpay?: RazorpayClient;
  play?: PlayVerifier;
  now: () => Date;
}

/** Side effects to run only after a transaction commits (push, video room changes). */
export type After = (() => Promise<void>)[];
export async function runAfter(ctx: Ctx, after: After) {
  for (const fn of after) {
    try { await fn(); } catch (e) { ctx.log.warn(e, 'after-commit task failed'); }
  }
}
