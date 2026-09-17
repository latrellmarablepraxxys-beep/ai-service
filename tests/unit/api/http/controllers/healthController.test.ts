import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { createHealthController } from '@api/http/controllers/HealthController.js';
import type { HealthResponse } from '@interfaces/http.js';

import {healthStatus, stubProbe} from '../stubDependencies.js';

describe('createHealthController',
  () => {
    it('returns 200 ok when every probe is connected',
      async () => {
        const app = express();
        app.get('/health', createHealthController({
          mongoHealth: stubProbe(healthStatus()),
          redisHealth: stubProbe(healthStatus()),
          typesenseHealth: stubProbe(healthStatus()),
          llmHealth: stubProbe(healthStatus()),
        }));

        const response = await request(app).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(body.checks.mongo.connected).toBe(true);
        expect(body.checks.redis.connected).toBe(true);
        expect(body.checks.typesense.connected).toBe(true);
        expect(body.checks.llm.connected).toBe(true);
      });

    it('returns 503 degraded when one probe rejects',
      async () => {
        const app = express();
        app.get('/health', createHealthController({
          mongoHealth: stubProbe(healthStatus()),
          redisHealth: () => Promise.reject(new Error('connection refused')),
          typesenseHealth: stubProbe(healthStatus()),
          llmHealth: stubProbe(healthStatus()),
        }));

        const response = await request(app).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.redis).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });
  });
