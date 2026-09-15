import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { errorHandler } from '@api/http/middleware/ErrorHandler.js';
import { validatePaginationQuery } from '@api/http/validators/PaginationQueryValidator.js';
import type { ErrorResponse } from '@interfaces/errors.js';

interface Pagination {
  page: number;
  perPage: number;
}

interface ErrorFields {
  fields: Record<string, string[]>;
}

const fieldsOf = (body: ErrorResponse): Record<string, string[]> =>
  (body.error.details as unknown as ErrorFields).fields;

const buildApp = () => {
  const app = express();
  app.get('/items',
    validatePaginationQuery,
    (req, res) => {
      res.json({ query: req.query });
    });
  app.use(errorHandler);
  return app;
};

describe('paginationQueryValidator',
  () => {
    it('applies defaults when query params are omitted',
      async () => {
        const response = await request(buildApp()).get('/items');
        const body = response.body as { query: Pagination };

        expect(response.status).toBe(200);
        expect(body.query).toEqual({
          page: 1,
          perPage: 20 
        });
      });

    it('coerces numeric query strings',
      async () => {
        const response = await request(buildApp()).get('/items').query({
          page: '3',
          perPage: '25' 
        });
        const body = response.body as { query: Pagination };

        expect(body.query).toEqual({
          page: 3,
          perPage: 25 
        });
      });

    it('strips unknown query params',
      async () => {
        const response = await request(buildApp()).get('/items').query({
          page: '2',
          sort: 'name' 
        });
        const body = response.body as { query: Pagination };

        expect(body.query).toEqual({
          page: 2,
          perPage: 20 
        });
        expect(body.query).not.toHaveProperty('sort');
      });

    it('rejects out-of-range pagination with fields.page',
      async () => {
        const response = await request(buildApp()).get('/items').query({ page: '0' });
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(fieldsOf(body).page?.length ?? 0).toBeGreaterThan(0);
      });

    it('rejects non-numeric pagination with fields.perPage',
      async () => {
        const response = await request(buildApp()).get('/items').query({ perPage: 'abc' });
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(fieldsOf(body).perPage?.length ?? 0).toBeGreaterThan(0);
      });

    it('accepts perPage at the 100 cap',
      async () => {
        const response = await request(buildApp()).get('/items').query({ perPage: '100' });
        const body = response.body as { query: Pagination };

        expect(response.status).toBe(200);
        expect(body.query).toEqual({
          page: 1,
          perPage: 100 
        });
      });

    it('rejects perPage above the 100 cap with fields.perPage',
      async () => {
        const response = await request(buildApp()).get('/items').query({ perPage: '1000000' });
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(fieldsOf(body).perPage?.length ?? 0).toBeGreaterThan(0);
      });
  });
