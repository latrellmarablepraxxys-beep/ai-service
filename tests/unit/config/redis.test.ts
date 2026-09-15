import {
  describe, expect, it 
} from 'vitest';

import { appConfig } from '@config/app.js';
import { redisConfig } from '@config/redis.js';

describe('redisConfig',
  () => {
    it('namespaces BullMQ queue names with the app name',
      () => {
        expect(redisConfig.queuePrefix).toContain(appConfig.name);
        expect(redisConfig.queuePrefix.endsWith(':queue:')).toBe(true);
      });

    it('keeps the shared connection url and command timeout',
      () => {
        expect(redisConfig.url).toBe('redis://localhost:6379');
        expect(redisConfig.commandTimeoutMs).toBe(2000);
      });
  });
