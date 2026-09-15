import {
  describe, expect, it 
} from 'vitest';

import { RunStatus } from '@enums/RunStatus.js';

describe('RunStatus',
  () => {
    it('maps members to ints starting at 1',
      () => {
        expect(RunStatus.Running).toBe(1);
        expect(RunStatus.Completed).toBe(2);
        expect(RunStatus.Failed).toBe(3);
        expect(RunStatus.Interrupted).toBe(4);
      });

    it('reverse-maps ints to PascalCase member names',
      () => {
        expect(RunStatus[1]).toBe('Running');
        expect(RunStatus[2]).toBe('Completed');
        expect(RunStatus[3]).toBe('Failed');
        expect(RunStatus[4]).toBe('Interrupted');
      });
  });
