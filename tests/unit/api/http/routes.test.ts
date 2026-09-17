import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { buildExpressApp } from '@src/app.js';
import type { HealthResponse } from '@interfaces/http.js';
import {
  healthStatus, stubDependencies, stubProbe 
} from './stubDependencies.js';

describe('GET /health',
  () => {
    it('returns 200 ok when every probe is connected',
      async () => {
        const response = await request(buildExpressApp(stubDependencies())).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(body.checks).toEqual({
          mongo: {
            connected: true,
            latencyMs: 1 
          },
          redis: {
            connected: true,
            latencyMs: 1 
          },
          typesense: {
            connected: true,
            latencyMs: 1 
          },
          llm: {
            connected: true,
            latencyMs: 1 
          },
        });
      });

    it('returns 503 degraded with per-check flags when one probe is down',
      async () => {
        const dependencies = stubDependencies({
          redisHealth: stubProbe(healthStatus({
            connected: false,
            latencyMs: undefined 
          })),
        });

        const response = await request(buildExpressApp(dependencies)).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.mongo.connected).toBe(true);
        expect(body.checks.redis.connected).toBe(false);
        expect(body.checks.redis.latencyMs).toBeUndefined();
        expect(body.checks.typesense.connected).toBe(true);
      });

    it('degrades when a probe rejects instead of returning a status',
      async () => {
        const dependencies = stubDependencies({redisHealth: () => Promise.reject(new Error('connection refused')),});

        const response = await request(buildExpressApp(dependencies)).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.redis).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });

    it('degrades when every probe is down',
      async () => {
        const down = stubProbe(healthStatus({
          connected: false,
          latencyMs: undefined 
        }));
        const dependencies = stubDependencies({
          mongoHealth: down,
          redisHealth: down,
          typesenseHealth: down,
          llmHealth: down,
        });

        const response = await request(buildExpressApp(dependencies)).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.mongo.connected).toBe(false);
        expect(body.checks.redis.connected).toBe(false);
        expect(body.checks.typesense.connected).toBe(false);
        expect(body.checks.llm.connected).toBe(false);
      });

    it('degrades when the LLM probe is down',
      async () => {
        const dependencies = stubDependencies({
          llmHealth: stubProbe(healthStatus({
            connected: false,
            latencyMs: undefined 
          })),
        });

        const response = await request(buildExpressApp(dependencies)).get('/health');
        const body = response.body as HealthResponse;

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.llm).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });
  });

describe('GET /metrics',
  () => {
    it('renders prometheus metrics as text',
      async () => {
        const response = await request(buildExpressApp(stubDependencies())).get('/metrics');

        expect(response.status).toBe(200);
        // Express normalizes the prom-client content type; params are re-serialized
        // with charset first. Assert the full value rather than a loose `toContain`.
        expect(response.headers['content-type']).toBe('text/plain; charset=utf-8; version=0.0.4');
        expect(response.text).toContain('http_request_duration_seconds');
      });

    it('renders an injected metrics snapshot when one is provided',
      async () => {
        const dependencies = stubDependencies({
          metrics: {
            contentType: 'text/x-injected',
            render: () => Promise.resolve('injected metrics body'),
          },
        });

        const response = await request(buildExpressApp(dependencies)).get('/metrics');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/^text\/x-injected/);
        expect(response.text).toBe('injected metrics body');
      });
  });

describe('route audiences',
  () => {
    it('keeps the admin API off the root path',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .post('/tickets/TK-00001/conversations')
          .send({});

        expect(response.status).toBe(404);
      });
  });
