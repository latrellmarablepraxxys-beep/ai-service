import type { WithId } from 'mongodb';
import { z } from 'zod';

import { ThreadStatus } from '../../enums/ThreadStatus.js';
import type { CollectionName, IndexSpec } from '../../interfaces/mongo.js';
import type { Thread } from '../../interfaces/persistence.js';

export const THREAD_COLLECTION = 'threads' satisfies CollectionName;

export const THREAD_INDEXES: readonly IndexSpec[] = [
  {
    key: { ticketId: 1 },
    unique: true 
  },
  { key: { status: 1 } },
  { key: { updatedAt: -1 } },
];

export const threadDocumentSchema = z
  .object({
    ticketId: z.string().min(1),
    status: z.nativeEnum(ThreadStatus),
    route: z.enum([
      'ai',
      'agent',
      'queue'
    ]),
    metadata: z.record(z.unknown()),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strip();

export type ThreadDocument = z.infer<typeof threadDocumentSchema>;

/** Read mapper: validates the stored body and lifts `_id` to the boundary `id`. */
export const toThread = (doc: WithId<ThreadDocument>): Thread => {
  const {
    _id, ...rest 
  } = doc;
  return {
    id: _id.toString(),
    ...threadDocumentSchema.parse(rest),
  };
};

/** Write validator: fails fast when a repository would persist a malformed document. */
export const toThreadDocument = (doc: ThreadDocument): ThreadDocument =>
  threadDocumentSchema.parse(doc);
