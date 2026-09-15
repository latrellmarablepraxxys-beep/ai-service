import {
  describe, expect, it 
} from 'vitest';

import { RunStatus } from '@enums/RunStatus.js';
import { ThreadStatus } from '@enums/ThreadStatus.js';
import { TicketPriority } from '@enums/TicketPriority.js';
import { TicketStatus } from '@enums/TicketStatus.js';

describe('enum wire format',
  () => {
    it('serializes to numbers in JSON responses, not names',
      () => {
        const body = {
          status: TicketStatus.Open,
          priority: TicketPriority.Urgent 
        };
        expect(JSON.stringify(body)).toBe('{"status":1,"priority":4}');
      });

    it('serializes thread and run statuses to numbers in JSON responses',
      () => {
        const body = {
          threadStatus: ThreadStatus.Escalated,
          runStatus: RunStatus.Interrupted,
        };
        expect(JSON.stringify(body)).toBe('{"threadStatus":2,"runStatus":4}');
      });

    it('holds int values starting at 1',
      () => {
        expect(TicketStatus.Escalated).toBe(5);
        expect(TicketPriority.High).toBe(3);
        expect(ThreadStatus.Closed).toBe(3);
        expect(RunStatus.Failed).toBe(3);
        expect(ThreadStatus.Active).toBe(1);
        expect(RunStatus.Running).toBe(1);
      });
  });
