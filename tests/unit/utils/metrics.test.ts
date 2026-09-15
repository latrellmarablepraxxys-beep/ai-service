import {
  describe, expect, it 
} from 'vitest';

import { getMetrics, metrics } from '@utils/metrics.js';

describe('metrics',
  () => {
    it('exposes the expected metric instruments',
      () => {
        expect(metrics.httpRequestDuration).toBeDefined();
        expect(metrics.graphRunDuration).toBeDefined();
        expect(metrics.llmTokensTotal).toBeDefined();
        expect(metrics.cacheHits).toBeDefined();
        expect(metrics.cacheMisses).toBeDefined();
        expect(metrics.activeSessions).toBeDefined();
      });

    it('renders registered metrics to text',
      async () => {
        metrics.httpRequestDuration.observe({
          method: 'GET',
          route: '/health',
          status: 200 
        },
        0.01);
        metrics.activeSessions.set(2);

        const output = await getMetrics();

        expect(output).toContain('http_request_duration_seconds');
        expect(output).toContain('active_sessions');
      });
  });
