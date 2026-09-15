import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { createRateLimiter } from '@api/http/middleware/RateLimit.js';
import type { ErrorResponse } from '@interfaces/errors.js';

/** Minimal app with a tiny limiter so the second request trips the 429 path. */
const buildLimitedApp = () => {
  const app = express();
  app.use(createRateLimiter({
    max: 1,
    windowMs: 60_000 
  }));
  app.get('/limited',
    (_req, res) => {
      res.json({ ok: true });
    });
  return app;
};

describe('createRateLimiter',
  () => {
    it('allows requests under the limit',
      async () => {
        const response = await request(buildLimitedApp()).get('/limited');

        expect(response.status).toBe(200);
      });

    it('returns a 429 with the standard error envelope once the limit is exceeded',
      async () => {
        const app = buildLimitedApp();

        await request(app).get('/limited');
        const response = await request(app).get('/limited');
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(429);
        expect(response.headers['content-type']).toContain('application/json');
        expect(body).toEqual({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests' 
          },
        });
      });
  });
