import request from 'supertest';
import {
  afterEach, describe, expect, it, vi 
} from 'vitest';

import { buildExpressApp } from '@src/app.js';
import { appConfig } from '@config/app.js';
import { stubDependencies } from './api/http/stubDependencies.js';

describe('buildExpressApp',
  () => {
    it('applies helmet security headers and hides x-powered-by',
      async () => {
        const response = await request(buildExpressApp(stubDependencies())).get('/health');

        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-powered-by']).toBeUndefined();
      });

    it('allows the configured frontend origin with credentials',
      async () => {
        const response = await request(buildExpressApp(stubDependencies()))
          .get('/health')
          .set('Origin', appConfig.frontendUrl);

        expect(response.headers['access-control-allow-origin']).toBe(appConfig.frontendUrl);
        expect(response.headers['access-control-allow-credentials']).toBe('true');
      });
  });

/**
 * `appConfig` snapshots env at import time, so each case re-imports a fresh app
 * module after stubbing `TRUST_PROXY`.
 */
describe('trust proxy',
  () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('leaves trust proxy at the express default when TRUST_PROXY is empty',
      async () => {
        const { buildExpressApp } = await import('@src/app.js');

        const app = buildExpressApp(stubDependencies());

        expect(app.get('trust proxy')).toBe(false);
      });

    it('sets a boolean when TRUST_PROXY is "true"',
      async () => {
        vi.stubEnv('TRUST_PROXY', 'true');
        const { buildExpressApp } = await import('@src/app.js');

        const app = buildExpressApp(stubDependencies());

        expect(app.get('trust proxy')).toBe(true);
      });

    it('passes a hop count string through',
      async () => {
        vi.stubEnv('TRUST_PROXY', '1');
        const { buildExpressApp } = await import('@src/app.js');

        const app = buildExpressApp(stubDependencies());

        expect(app.get('trust proxy')).toBe('1');
      });
  });
