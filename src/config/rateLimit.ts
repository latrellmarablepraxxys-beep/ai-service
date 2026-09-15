import { env } from './env.js';

export const rateLimitConfig = Object.freeze({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
});

export type RateLimitConfig = typeof rateLimitConfig;
