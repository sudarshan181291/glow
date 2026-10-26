import { z } from 'zod';

// All settings come from environment variables (see .env.example).
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  OTP_PEPPER: z.string().min(16),
  CORS_ORIGINS: z.string().default(''),

  // OTP SMS
  OTP_PROVIDER: z.enum(['console', 'msg91']).default('console'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  DEV_FIXED_OTP: z.string().optional(), // only honoured outside production

  // LiveKit
  LIVEKIT_URL: z.string().default('wss://example.livekit.cloud'),
  LIVEKIT_API_KEY: z.string().default('devkey'),
  LIVEKIT_API_SECRET: z.string().default('devsecret-devsecret-devsecret-devsecret'),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Google Play
  PLAY_PACKAGE_NAME: z.string().default('com.mehfillive.studioroyale'),
  PLAY_SERVICE_ACCOUNT_JSON: z.string().optional(), // the JSON key, as one line
  PLAY_RTDN_TOKEN: z.string().optional(), // shared secret appended to the Pub/Sub push URL

  // Expo push
  EXPO_ACCESS_TOKEN: z.string().optional(),

  ENGINE_TICK_MS: z.coerce.number().default(1000),
  RATE_LIMIT_ALLOWLIST: z.string().default(''), // comma-separated IPs exempt from rate limits (tests, health checks)
});

export type Env = z.infer<typeof Env>;

export function loadEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  const parsed = Env.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${msg}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const need: (keyof Env)[] = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
    if (env.OTP_PROVIDER !== 'msg91') throw new Error('OTP_PROVIDER must be msg91 in production');
    for (const k of need) if (!env[k]) throw new Error(`${k} is required in production`);
    if (env.LIVEKIT_API_KEY === 'devkey') throw new Error('Set real LIVEKIT_API_KEY / LIVEKIT_API_SECRET in production');
  }
  return env;
}

// Coin packs. Product ids are used as Google Play product ids too.
export const COIN_PACKS = [
  { id: 'coins_100', coins: 100, pricePaise: 10000 },
  { id: 'coins_550', coins: 550, pricePaise: 50000 },
  { id: 'coins_1200', coins: 1200, pricePaise: 100000 },
  { id: 'coins_6500', coins: 6500, pricePaise: 500000 },
] as const;
export const VIP_PRODUCT = { id: 'vip_month', pricePaise: 99900, days: 30, playSubscriptionId: 'vip_monthly' } as const;

// Studio settings editable at runtime (stored in studios.config).
export const DEFAULT_STUDIO_CONFIG = {
  minStage: 12,
  stageCap: 16,
  maxRooms: 6,
  defaultSplit: 50,
  price5: 500,
  price15: 1300,
  ext: 500,
  shoutout: 100,
  firstBonus: 50,
  packageCoins: 2500,
  packageRooms: 6,
  requestTimeoutSec: 20,
  backfillDelayMs: 1500,
  exclusiveUnlock: 10000,
  vipGiftDiscountPct: 20,
  coinValuePaise: 75, // used to convert dancer coin earnings to rupees for payouts
  followerMsgIntervalMin: 10,
  chatMaxLen: 300,
};
export type StudioConfig = typeof DEFAULT_STUDIO_CONFIG;
