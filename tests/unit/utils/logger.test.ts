import {
  describe, expect, it 
} from 'vitest';

import { childLogger, logger } from '@utils/logger.js';

describe('logger',
  () => {
    it('is silent under NODE_ENV=test so tests produce no pino output',
      () => {
        expect(logger.level).toBe('silent');
      });

    it('creates child loggers without throwing',
      () => {
        const child = childLogger({ requestId: 'req_1' });

        expect(child.bindings()).toEqual({ requestId: 'req_1' });
      });
  });
