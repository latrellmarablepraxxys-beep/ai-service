import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { errorHandler } from '@api/http/middleware/ErrorHandler.js';
import { buildExpressApp } from '@src/app.js';
import type { ErrorResponse } from '@interfaces/errors.js';
import { AppError } from '@utils/errors.js';
import { stubDependencies } from '../stubDependencies.js';

/** Minimal app whose only route throws the supplied value, wired to the real handler. */
const buildThrowingApp = (error: unknown) => {
  const app = express();
  app.get('/boom',
    () => {
      throw error;
    });
  app.use(errorHandler);
  return app;
};

describe('errorHandler',
  () => {
    it('maps an AppError to its status, code, and message',
      async () => {
        const app = buildThrowingApp(new AppError('TEAPOT', 418, 'Short and stout'));

        const response = await request(app).get('/boom');
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(418);
        expect(body).toEqual({
          success: false,
          error: {
            code: 'TEAPOT',
            message: 'Short and stout' 
          },
        });
      });

    it('maps an unknown error to 500 INTERNAL_ERROR',
      async () => {
        const app = buildThrowingApp(new Error('boom'));

        const response = await request(app).get('/boom');
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(500);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('INTERNAL_ERROR');
      });

    it('defaults a non-Error throw to 500 INTERNAL_ERROR',
      async () => {
        const app = buildThrowingApp({ unexpected: true });

        const response = await request(app).get('/boom');
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(500);
        expect(body.error.code).toBe('INTERNAL_ERROR');
      });

    it('maps a malformed JSON body to 400 INVALID_JSON',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .post('/missing')
          .set('Content-Type', 'application/json')
          .send('{ not valid json');
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(400);
        expect(body.error.code).toBe('INVALID_JSON');
      });

    it('maps an oversize JSON body to 413 PAYLOAD_TOO_LARGE',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .post('/missing')
          .set('Content-Type', 'application/json')
          .send(`{"content":"${'x'.repeat(2 * 1024 * 1024)}"}`);
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(413);
        expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
      });
  });

describe('notFound',
  () => {
    it('returns the standard error envelope for unknown routes',
      async () => {
        const response = await request(buildExpressApp(stubDependencies())).get('/missing');
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(404);
        expect(body).toEqual({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Route not found' 
          },
        });
      });
  });
