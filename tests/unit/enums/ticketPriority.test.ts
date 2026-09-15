import {
  describe, expect, it 
} from 'vitest';

import { TicketPriority } from '@enums/TicketPriority.js';

describe('TicketPriority',
  () => {
    it('maps members to ints starting at 1',
      () => {
        expect(TicketPriority.Low).toBe(1);
        expect(TicketPriority.Medium).toBe(2);
        expect(TicketPriority.High).toBe(3);
        expect(TicketPriority.Urgent).toBe(4);
      });

    it('reverse-maps ints to PascalCase member names',
      () => {
        expect(TicketPriority[1]).toBe('Low');
        expect(TicketPriority[2]).toBe('Medium');
        expect(TicketPriority[3]).toBe('High');
        expect(TicketPriority[4]).toBe('Urgent');
      });
  });

