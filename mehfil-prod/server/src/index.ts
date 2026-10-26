import { loadEnv } from './config.js';
import type { Ctx } from './ctx.js';
import { buildApp, makeFastify } from './app.js';
import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { Tokens } from './lib/auth.js';
import { EngineRunner } from './services/engine.js';
import { ConsoleOtp, Msg91Otp } from './services/otp.js';
import { GooglePlay } from './services/payments/play.js';
import { Razorpay } from './services/payments/razorpay.js';
import { ExpoPush } from './services/push.js';
import { Realtime } from './services/realtime.js';
import { LiveKitVideo } from './services/video.js';

const env = loadEnv();
const app = makeFastify(env.NODE_ENV === 'production' ? 'info' : 'debug');
const db = createPool(env.DATABASE_URL);
const applied = await migrate(db);
if (applied.length) app.log.info({ applied }, 'migrations applied');

const ctx: Ctx = {
  env, db, log: app.log,
  rt: new Realtime(db, app.log),
  video: new LiveKitVideo(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET),
  otp: env.OTP_PROVIDER === 'msg91' ? new Msg91Otp(env.MSG91_AUTH_KEY!, env.MSG91_TEMPLATE_ID!) : new ConsoleOtp(app.log),
  push: new ExpoPush(db, app.log, env.EXPO_ACCESS_TOKEN),
  tokens: new Tokens(env.JWT_SECRET),
  razorpay: env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? new Razorpay(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET ?? '') : undefined,
  play: env.PLAY_SERVICE_ACCOUNT_JSON ? new GooglePlay(env.PLAY_PACKAGE_NAME, env.PLAY_SERVICE_ACCOUNT_JSON) : undefined,
  now: () => new Date(),
};

await ctx.rt.start();
await buildApp(ctx, app);
const engine = new EngineRunner(ctx);
await engine.start();
await app.listen({ port: env.PORT, host: env.HOST });

const shutdown = async (sig: string) => {
  app.log.info(`${sig} received, shutting down`);
  await engine.stop();
  await app.close();
  await ctx.rt.stop();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
