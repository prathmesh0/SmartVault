import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Every limiter funnels through one handler so a throttled request always
// comes back as our standard error envelope with a 429 — not the library's
// default plain-text response.
const reject = (_req: Request, _res: unknown, next: (err: unknown) => void) => {
  next(ApiError.tooManyRequests());
};

// In tests we don't want shared counters tripping assertions at random or
// accumulating across test files, so limits effectively turn off.
const disabled = env.NODE_ENV === 'test';

// Broad safety net for the whole API, per IP.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
  handler: reject,
});

// Brute-force protection on the credential endpoints, per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
  handler: reject,
});

// Uploads are expensive (cloud + AI) and per-user, so the key is the
// authenticated user id rather than the IP. `authenticate` runs before this
// in the route chain, so req.user is always populated here.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
  keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? ''),
  handler: reject,
});
