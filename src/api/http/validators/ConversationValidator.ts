import { z } from 'zod';

import type {
  ConversationRequest,
  InboundConversationMessage,
  InboundCustomer,
} from '../../../interfaces/conversation.js';
import { createValidator } from './Validate.js';

export const conversationParamsSchema = z
  .object({ticketId: z.string().min(1),})
  .strip();
export type ConversationParams = z.infer<typeof conversationParamsSchema>;
export const validateConversationParams = createValidator({
  schema: conversationParamsSchema,
  source: 'params',
});

const attachmentSchema = z
  .object({
    type: z.string().min(1),
    url: z.string().url(),
  })
  .strip();

const messageSchema = z
  .object({
    external_id: z.string().min(1).optional(),
    role: z.enum([
      'user',
      'assistant',
      'system',
      'tool'
    ]),
    body: z.string().min(1),
    attachments: z.array(attachmentSchema).optional(),
    sent_at: z.string().min(1).optional(),
  })
  .strip();

const customerSchema = z
  .object({display_name: z.string().min(1).optional(),})
  .strip();

type WireMessage = z.infer<typeof messageSchema>;
type WireCustomer = z.infer<typeof customerSchema>;

const toInboundMessage = (value: WireMessage): InboundConversationMessage => ({
  role: value.role,
  body: value.body,
  ...(value.external_id !== undefined && { externalId: value.external_id }),
  ...(value.attachments !== undefined && { attachments: value.attachments }),
  ...(value.sent_at !== undefined && { sentAt: value.sent_at }),
});

const toCustomer = (value: WireCustomer | undefined): InboundCustomer | undefined => {
  if (value?.display_name === undefined) return undefined;
  return { displayName: value.display_name };
};

export const conversationBodySchema = z
  .object({
    context_history: z.array(messageSchema).optional(),
    latest_message: messageSchema,
    customer: customerSchema.optional(),
  })
  .strip()
  .transform((value): ConversationRequest => {
    const customer = toCustomer(value.customer);

    return {
      contextHistory: value.context_history?.map(toInboundMessage) ?? [],
      latestMessage: toInboundMessage(value.latest_message),
      ...(customer === undefined ? {} : { customer }),
    };
  });
export type ConversationBody = z.infer<typeof conversationBodySchema>;
export const validateConversationBody = createValidator({
  schema: conversationBodySchema,
  source: 'body',
});
