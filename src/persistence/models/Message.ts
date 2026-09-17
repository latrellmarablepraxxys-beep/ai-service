import type { WithId } from 'mongodb';
import { z } from 'zod';

import type { CollectionName, IndexSpec } from '../../interfaces/mongo.js';
import type { Message } from '../../interfaces/persistence.js';

export const MESSAGE_COLLECTION = 'messages' satisfies CollectionName;

export const MESSAGE_INDEXES: readonly IndexSpec[] = [
  {
    key: {
      threadId: 1,
      createdAt: 1 
    } 
  },
  {
    key: {
      threadId: 1,
      _id: 1 
    } 
  }
];

export const messageDocumentSchema = z
  .object({
    threadId: z.string().min(1),
    role: z.enum([
      'user',
      'assistant',
      'system',
      'tool'
    ]),
    content: z.string(),
    tokenCount: z.number().int().nonnegative().optional(),
    metadata: z.record(z.unknown()),
    createdAt: z.string().min(1),
  })
  .strip();

export type MessageDocument = z.infer<typeof messageDocumentSchema>;

/** Read mapper: validates the stored body and lifts `_id` to the boundary `id`. */
export const toMessage = (doc: WithId<MessageDocument>): Message => {
  const {
    _id, ...rest 
  } = doc;
  const parsed = messageDocumentSchema.parse(rest);
  return {
    id: _id.toString(),
    ...parsed,
    tokenCount: parsed.tokenCount ?? undefined,
  };
};

/** Write validator: fails fast when a repository would persist a malformed document. */
export const toMessageDocument = (doc: MessageDocument): MessageDocument =>
  messageDocumentSchema.parse(doc);
