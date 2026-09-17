import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { createSystemRouter } from '@api/http/routers/SystemRouter.js';
import type { HealthResponse } from '@interfaces/http.js';

import { stubDependencies } from '../stubDependencies.js';

const buildApp = () => {
  const app = express();
  app.use(createSystemRouter(stubDependencies()));
  return app;
};

describe('createSystemRouter',
  () => {
    it('serves GET /health with every probe',
      async () => {
        const response = await request(buildApp()).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(Object.keys(body.checks)).toEqual([
          'mongo',
          'redis',
          'typesense',
          'llm'
        ]);
      });

    it('serves GET /metrics',
      async () => {
        const response = await request(buildApp()).get('/metrics');

        expect(response.status).toBe(200);
        expect(response.text).toContain('http_request_duration_seconds');
      });
  });
