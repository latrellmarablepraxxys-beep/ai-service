import { z } from 'zod';

import { createValidator } from './Validate.js';

export const sendMessageParamsSchema = z
  .object({id: z.string().min(1),})
  .strip();

export type SendMessageParams = z.infer<typeof sendMessageParamsSchema>;

export const validateSendMessageParams = createValidator({
  schema: sendMessageParamsSchema,
  source: 'params',
});

export const sendMessageBodySchema = z
  .object({
    content: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;

export const validateSendMessageBody = createValidator({
  schema: sendMessageBodySchema,
  source: 'body',
});
