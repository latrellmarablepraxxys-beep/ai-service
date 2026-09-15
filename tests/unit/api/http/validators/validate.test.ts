import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';
import { z } from 'zod';

import { errorHandler } from '@api/http/middleware/ErrorHandler.js';
import { createValidator } from '@api/http/validators/Validate.js';
import type { ErrorResponse } from '@interfaces/errors.js';

interface ErrorFields {
  fields: Record<string, string[]>;
}

const fieldsOf = (body: ErrorResponse): Record<string, string[]> =>
  (body.error.details as unknown as ErrorFields).fields;

const buildApp = () => {
  const app = express();
  app.use(express.json());

  app.post(
    '/echo',
    createValidator({
      schema: z.object({ name: z.string() }).strip(),
      source: 'body' 
    }),
    (req, res) => {
      res.json({ body: req.body as unknown });
    },
  );

  app.get(
    '/search',
    createValidator({
      schema: z.object({ page: z.coerce.number().int().min(1).default(1) }).strip(),
      source: 'query',
    }),
    (req, res) => {
      res.json({ query: req.query });
    },
  );

  app.get(
    '/items/:id',
    createValidator({
      schema: z.object({ id: z.string().min(1) }).strip(),
      source: 'params' 
    }),
    (req, res) => {
      res.json({ params: req.params });
    },
  );

  app.post(
    '/nested',
    createValidator({
      schema: z.object({ profile: z.object({ email: z.string().email() }) }),
      source: 'body',
    }),
    (_req, res) => {
      res.json({ ok: true });
    },
  );

  app.post(
    '/root',
    createValidator({
      schema: z.object({ name: z.string() }).refine(() => false, { message: 'nope' }),
      source: 'body',
    }),
    (_req, res) => {
      res.json({ ok: true });
    },
  );

  app.use(errorHandler);
  return app;
};

describe('createValidator',
  () => {
    it('passes valid input through to the next handler',
      async () => {
        const response = await request(buildApp()).post('/echo').send({ name: 'Ada' });
        const body = response.body as { body: { name: string } };

        expect(response.status).toBe(200);
        expect(body.body).toEqual({ name: 'Ada' });
      });

    it('writes the parsed output back to the request, stripping unknown keys',
      async () => {
        const response = await request(buildApp())
          .post('/echo')
          .send({
            name: 'Ada',
            extra: 'dropped' 
          });
        const body = response.body as { body: { name: string } };

        expect(response.status).toBe(200);
        expect(body.body).toEqual({ name: 'Ada' });
        expect(body.body).not.toHaveProperty('extra');
      });

    it('coerces query strings and applies schema defaults',
      async () => {
        const app = buildApp();

        const coerced = await request(app).get('/search').query({ page: '3' });
        const coercedBody = coerced.body as { query: { page: number } };
        expect(coercedBody.query).toEqual({ page: 3 });

        const defaulted = await request(app).get('/search');
        const defaultedBody = defaulted.body as { query: { page: number } };
        expect(defaultedBody.query).toEqual({ page: 1 });
      });

    it('validates the params source',
      async () => {
        const response = await request(buildApp()).get('/items/abc123');
        const body = response.body as { params: { id: string } };

        expect(response.status).toBe(200);
        expect(body.params).toEqual({ id: 'abc123' });
      });

    it('rejects invalid input with a 422 VALIDATION_ERROR envelope',
      async () => {
        const response = await request(buildApp()).post('/echo').send({ name: 123 });
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toBe('Validation failed');
        expect(fieldsOf(body).name?.length ?? 0).toBeGreaterThan(0);
        for (const message of fieldsOf(body).name ?? []) {
          expect(typeof message).toBe('string');
        }
      });

    it('joins nested field paths with dots and uses empty string for root issues',
      async () => {
        const app = buildApp();

        const nested = await request(app)
          .post('/nested')
          .send({ profile: { email: 'not-an-email' } });
        expect(Object.keys(fieldsOf(nested.body as ErrorResponse))).toEqual(['profile.email']);

        const root = await request(app).post('/root').send({ name: 'Ada' });
        expect(Object.keys(fieldsOf(root.body as ErrorResponse))).toEqual(['']);
      });

    it('does not leak Zod internals in the error details',
      async () => {
        const response = await request(buildApp()).post('/echo').send({ name: 123 });
        const body = response.body as ErrorResponse;
        const serialized = JSON.stringify(body);

        expect(Object.keys(body.error).sort()).toEqual([
          'code',
          'details',
          'message'
        ]);
        expect(Object.keys(body.error.details ?? {})).toEqual(['fields']);
        expect(serialized).not.toContain('"issues"');
        expect(serialized).not.toContain('"unionErrors"');
        expect(serialized).not.toContain('"minimum"');
      });
  });
