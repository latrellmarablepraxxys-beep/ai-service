import { z } from 'zod';

import { createValidator } from './Validate.js';

export const ticketIdParamsSchema = z
  .object({id: z.string().min(1),})
  .strip();

export type TicketIdParams = z.infer<typeof ticketIdParamsSchema>;

export const validateTicketIdParams = createValidator({
  schema: ticketIdParamsSchema,
  source: 'params',
});
