import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import { rateLimitConfig } from '../../../config/rateLimit.js';
import type { RateLimitOptions } from '../../../interfaces/http.js';
import { AppError, toErrorResponse } from '../../../utils/errors.js';

/**
 * Builds the rate-limiting middleware. A fresh instance per app keeps the
 * in-memory store scoped to that app (important for tests). Callers may override
 * `windowMs`/`max` so tests can exercise the limiter with a tiny budget.
 */
export const createRateLimiter = (options: RateLimitOptions = {}): RequestHandler =>
  rateLimit({
    windowMs: options.windowMs ?? rateLimitConfig.windowMs,
    max: options.max ?? rateLimitConfig.max,
    standardHeaders: true,
    legacyHeaders: false,
    // Rate-limit rejections use the same error envelope as every other failure.
    handler: (_req, res) =>
      res.status(429).json(toErrorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests'))),
  });
