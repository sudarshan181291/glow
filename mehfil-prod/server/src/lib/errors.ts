export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}
export const bad = (code: string, msg: string, extra?: Record<string, unknown>) => new AppError(400, code, msg, extra);
export const unauthorized = (msg = 'Please sign in') => new AppError(401, 'unauthorized', msg);
export const forbidden = (msg = 'Not allowed') => new AppError(403, 'forbidden', msg);
export const notFound = (what = 'Not found') => new AppError(404, 'not_found', what);
export const conflict = (code: string, msg: string, extra?: Record<string, unknown>) => new AppError(409, code, msg, extra);
export const tooMany = (msg = 'Too many requests, slow down') => new AppError(429, 'rate_limited', msg);
