import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { errorHandler } from '@api/http/middleware/ErrorHandler.js';
import {
  validateSendMessageBody,
  validateSendMessageParams,
} from '@api/http/validators/SendMessageValidator.js';
import type { ErrorResponse } from '@interfaces/errors.js';

interface SendMessageBody {
  content: string;
  metadata?: Record<string, unknown>;
}

interface SendMessageResponse {
  params: { id: string };
  body: SendMessageBody;
}

interface ErrorFields {
  fields: Record<string, string[]>;
}

const fieldsOf = (body: ErrorResponse): Record<string, string[]> =>
  (body.error.details as unknown as ErrorFields).fields;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/tickets/:id/messages',
    validateSendMessageParams,
    validateSendMessageBody,
    (req, res) => {
      res.json({
        params: req.params,
        body: req.body as unknown 
      });
    },
  );
  app.post('/tickets/messages',
    validateSendMessageParams,
    validateSendMessageBody,
    (req, res) => {
      res.json({
        params: req.params,
        body: req.body as unknown 
      });
    });
  app.use(errorHandler);
  return app;
};

describe('sendMessageValidator',
  () => {
    it('accepts a valid params id and body content',
      async () => {
        const response = await request(buildApp())
          .post('/tickets/t-1/messages')
          .send({ content: 'Hello there' });
        const body = response.body as SendMessageResponse;

        expect(response.status).toBe(200);
        expect(body.params).toEqual({ id: 't-1' });
        expect(body.body).toEqual({ content: 'Hello there' });
      });

    it('accepts and preserves optional metadata, stripping unknown body keys',
      async () => {
        const response = await request(buildApp())
          .post('/tickets/t-1/messages')
          .send({
            content: 'Hi',
            metadata: { locale: 'en' },
            extra: 'dropped' 
          });
        const body = response.body as SendMessageResponse;

        expect(response.status).toBe(200);
        expect(body.body).toEqual({
          content: 'Hi',
          metadata: { locale: 'en' } 
        });
        expect(body.body).not.toHaveProperty('extra');
      });

    it('rejects empty content with fields.content',
      async () => {
        const response = await request(buildApp()).post('/tickets/t-1/messages').send({ content: '' });
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(fieldsOf(body).content?.length ?? 0).toBeGreaterThan(0);
      });

    it('rejects a missing params id with fields.id',
      async () => {
        const response = await request(buildApp()).post('/tickets/messages').send({ content: 'Hello' });
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(fieldsOf(body).id?.length ?? 0).toBeGreaterThan(0);
      });

    it('rejects non-record metadata with fields.metadata',
      async () => {
        const response = await request(buildApp())
          .post('/tickets/t-1/messages')
          .send({
            content: 'Hi',
            metadata: 'not-a-record' 
          });
        const body = response.body as ErrorResponse;

        expect(response.status).toBe(422);
        expect(fieldsOf(body).metadata?.length ?? 0).toBeGreaterThan(0);
      });
  });
