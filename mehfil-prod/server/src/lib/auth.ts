import { SignJWT, jwtVerify } from 'jose';
import type { FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from './errors.js';

export type Role = 'guest' | 'customer' | 'dancer' | 'floor' | 'moderator' | 'admin';
export interface AuthUser { id: string; role: Role; guest: boolean }

declare module 'fastify' {
  interface FastifyRequest { auth?: AuthUser }
}

const ACCESS_TTL = '15m';
const GUEST_TTL = '12h';

export class Tokens {
  private key: Uint8Array;
  constructor(secret: string) { this.key = new TextEncoder().encode(secret); }

  access(id: string, role: Role) {
    return new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuedAt()
      .setExpirationTime(role === 'guest' ? GUEST_TTL : ACCESS_TTL).setIssuer('mehfil').sign(this.key);
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: 'mehfil', algorithms: ['HS256'] });
      const role = payload.role as Role;
      return { id: String(payload.sub), role, guest: role === 'guest' };
    } catch {
      throw unauthorized('Session expired, please sign in again');
    }
  }
}

export function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

/** Signed-in, non-guest user. */
export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.auth) throw unauthorized();
  if (req.auth.guest) throw unauthorized('Please sign in to continue');
  return req.auth;
}

export function requireRole(req: FastifyRequest, ...roles: Role[]): AuthUser {
  const u = requireUser(req);
  if (u.role !== 'admin' && !roles.includes(u.role)) throw forbidden();
  return u;
}

/** Anyone with a token, including guests (for watching). */
export function requireAny(req: FastifyRequest): AuthUser {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
