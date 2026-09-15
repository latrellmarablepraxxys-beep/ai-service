import {
  describe, expect, it 
} from 'vitest';

import { ThreadStatus } from '@enums/ThreadStatus.js';

describe('ThreadStatus',
  () => {
    it('maps members to ints starting at 1',
      () => {
        expect(ThreadStatus.Active).toBe(1);
        expect(ThreadStatus.Escalated).toBe(2);
        expect(ThreadStatus.Closed).toBe(3);
      });

    it('reverse-maps ints to PascalCase member names',
      () => {
        expect(ThreadStatus[1]).toBe('Active');
        expect(ThreadStatus[2]).toBe('Escalated');
        expect(ThreadStatus[3]).toBe('Closed');
      });
  });
