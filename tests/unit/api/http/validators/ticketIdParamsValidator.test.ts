import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { errorHandler } from '@api/http/middleware/ErrorHandler.js';
import { validateTicketIdParams } from '@api/http/validators/TicketIdParamsValidator.js';
import type { ErrorResponse } from '@interfaces/errors.js';

interface ErrorFields {
  fields: Record<string, string[]>;
}

const fieldsOf = (body: ErrorResponse): Record<string, string[]> =>
  (body.error.details as unknown as ErrorFields).fields;

const buildApp = () => {
  const app = express();
  app.get('/tickets/:id',
    validateTicketIdParams,
    (req, res) => {
      res.json({ params: req.params });
    });
  app.get('/tickets',
    validateTicketIdParams,
    (req, res) => {
      res.json({ params: req.params });
    });
  app.use(errorHandler);
  return app;
};

describe('ticketIdParamsValidator',
  () => {
    it('accepts a non-empty id and strips unknown params',
      async () => {
        const response = await request(buildApp()).get('/tickets/abc123');
        const body = response.body as { params: { id: string } };

        expect(response.status).toBe(200);
        expect(body.params).toEqual({ id: 'abc123' });
      });

    it('rejects a missing id with fields.id',
      async () => {
        const response = await request(buildApp()).get('/tickets');
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(fieldsOf(body).id?.length ?? 0).toBeGreaterThan(0);
      });
  });
