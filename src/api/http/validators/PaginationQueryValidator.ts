import { z } from 'zod';

import { createValidator } from './Validate.js';

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strip();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const validatePaginationQuery = createValidator({
  schema: paginationQuerySchema,
  source: 'query',
});
