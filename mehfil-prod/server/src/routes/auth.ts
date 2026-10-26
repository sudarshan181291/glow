import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Ctx } from '../ctx.js';
import { withTx } from '../db/pool.js';
import { otpCode, randomToken, sha256 } from '../lib/crypto.js';
import { bad, forbidden, tooMany, unauthorized } from '../lib/errors.js';
import type { Role } from '../lib/auth.js';

const REFRESH_DAYS = 30;

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+91[6-9]\d{9}$/.test(digits)) return digits;
  throw bad('bad_phone', 'Enter a valid 10-digit Indian mobile number');
}

function ageYears(dob: string, now: Date) {
  const d = new Date(`${dob}T00:00:00Z`);
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a -= 1;
  return a;
}

async function issueTokens(ctx: Ctx, userId: string, role: Role) {
  const refresh = randomToken(48);
  await ctx.db.query('INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, sha256(refresh), new Date(ctx.now().getTime() + REFRESH_DAYS * 864e5)]);
  return { access: await ctx.tokens.access(userId, role), refresh };
}

export function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const hashCode = (phone: string, code: string) => sha256(`${ctx.env.OTP_PEPPER}:${phone}:${code}`);

  // Watch without an account (BR-09): a short-lived guest token.
  app.post('/auth/guest', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async () => {
    const id = `guest-${randomToken(9)}`;
    return { access: await ctx.tokens.access(id, 'guest'), guestId: id };
  });

  app.post('/auth/otp/request', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req) => {
    const { phone: raw } = z.object({ phone: z.string() }).parse(req.body);
    const phone = normalisePhone(raw);
    const recent = await ctx.db.query(
      `SELECT created_at FROM otp_codes WHERE phone=$1 AND created_at > now() - interval '10 minutes' ORDER BY created_at DESC`, [phone]);
    if (recent.rows.length >= 3) throw tooMany('Too many codes requested. Try again in 10 minutes.');
    if (recent.rows[0] && ctx.now().getTime() - new Date(recent.rows[0].created_at).getTime() < 30000) throw tooMany('Please wait 30 seconds before asking for a new code');
    const code = ctx.env.NODE_ENV !== 'production' && ctx.env.DEV_FIXED_OTP ? ctx.env.DEV_FIXED_OTP : otpCode();
    await ctx.db.query('INSERT INTO otp_codes(phone, code_hash, expires_at) VALUES ($1,$2,$3)',
      [phone, hashCode(phone, code), new Date(ctx.now().getTime() + 5 * 60000)]);
    await ctx.otp.send(phone, code);
    const exists = (await ctx.db.query('SELECT 1 FROM users WHERE phone=$1', [phone])).rows.length > 0;
    return { sent: true, isNewUser: !exists };
  });

  app.post('/auth/otp/verify', { config: { rateLimit: { max: 40, timeWindow: '10 minutes' } } }, async (req) => {
    const body = z.object({
      phone: z.string(),
      code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
      displayName: z.string().trim().min(3).max(20).regex(/^[\w ]+$/, 'Use letters, numbers, spaces or _').optional(),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      ageConfirmed: z.boolean().optional(),
      lang: z.string().max(5).optional(),
    }).parse(req.body);
    const phone = normalisePhone(body.phone);

    const user = await withTx(ctx.db, async (tx) => {
      const c = (await tx.query(
        `SELECT * FROM otp_codes WHERE phone=$1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [phone])).rows[0];
      if (!c || new Date(c.expires_at) < ctx.now()) throw bad('code_expired', 'Code expired. Ask for a new one.');
      if (c.attempts >= 5) throw tooMany('Too many wrong attempts. Ask for a new code.');
      if (c.code_hash !== hashCode(phone, body.code)) {
        await tx.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [c.id]);
        return null;
      }
      await tx.query('UPDATE otp_codes SET used_at=now() WHERE id=$1', [c.id]);

      let u = (await tx.query('SELECT * FROM users WHERE phone=$1', [phone])).rows[0];
      if (!u) {
        if (!body.displayName) throw bad('need_name', 'Choose a display name');
        if (!body.dob || ageYears(body.dob, ctx.now()) < 18) throw forbidden('You must be 18 or older to use Mehfil Live');
        if (!body.ageConfirmed) throw bad('need_age', 'Please confirm you are 18 or older');
        try {
          u = (await tx.query(
            `INSERT INTO users(phone, display_name, dob, age_confirmed_at, lang) VALUES ($1,$2,$3,now(),$4) RETURNING *`,
            [phone, body.displayName, body.dob, body.lang ?? 'en'])).rows[0];
        } catch (e) {
          if ((e as { code?: string }).code === '23505') throw bad('name_taken', 'That display name is taken');
          throw e;
        }
        await tx.query('INSERT INTO wallets(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [u.id]);
      }
      if (u.banned_at) throw forbidden('This account has been suspended');
      return u;
    });
    if (!user) throw unauthorized('Wrong code');
    const tokens = await issueTokens(ctx, user.id, user.role);
    return { ...tokens, user: { id: user.id, displayName: user.display_name, role: user.role } };
  });

  app.post('/auth/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { refresh } = z.object({ refresh: z.string().min(20) }).parse(req.body);
    const out = await withTx(ctx.db, async (tx) => {
      const r = (await tx.query(
        `SELECT t.id, t.user_id, u.role, u.banned_at FROM refresh_tokens t JOIN users u ON u.id=t.user_id
         WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at > now() FOR UPDATE OF t`, [sha256(refresh)])).rows[0];
      if (!r || r.banned_at) throw unauthorized('Please sign in again');
      await tx.query('UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1', [r.id]);
      return r;
    });
    return issueTokens(ctx, out.user_id, out.role);
  });

  app.post('/auth/logout', async (req) => {
    const { refresh } = z.object({ refresh: z.string() }).parse(req.body);
    await ctx.db.query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1', [sha256(refresh)]);
    return { ok: true };
  });
}
