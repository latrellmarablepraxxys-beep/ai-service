import express from 'express';
import request from 'supertest';
import {
  describe, expect, it 
} from 'vitest';

import { createMetricsController } from '@api/http/controllers/MetricsController.js';

describe('createMetricsController',
  () => {
    it('renders the injected metrics snapshot',
      async () => {
        const app = express();
        app.get('/metrics', createMetricsController({
          metrics: {
            contentType: 'text/x-injected',
            render: () => Promise.resolve('injected metrics body'),
          },
        }));

        const response = await request(app).get('/metrics');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/^text\/x-injected/);
        expect(response.text).toBe('injected metrics body');
      });
  });
