import {
  describe, expect, it 
} from 'vitest';

import { TicketStatus } from '@enums/TicketStatus.js';

describe('TicketStatus',
  () => {
    it('maps members to ints starting at 1',
      () => {
        expect(TicketStatus.Open).toBe(1);
        expect(TicketStatus.Pending).toBe(2);
        expect(TicketStatus.Resolved).toBe(3);
        expect(TicketStatus.Closed).toBe(4);
        expect(TicketStatus.Escalated).toBe(5);
      });

    it('reverse-maps ints to PascalCase member names',
      () => {
        expect(TicketStatus[1]).toBe('Open');
        expect(TicketStatus[2]).toBe('Pending');
        expect(TicketStatus[3]).toBe('Resolved');
        expect(TicketStatus[4]).toBe('Closed');
        expect(TicketStatus[5]).toBe('Escalated');
      });
  });

