import type { WithId } from 'mongodb';
import { z } from 'zod';

import type { CollectionName, IndexSpec } from '../../interfaces/mongo.js';
import type { Memory } from '../../interfaces/persistence.js';

export const MEMORY_COLLECTION = 'memories' satisfies CollectionName;

export const MEMORY_INDEXES: readonly IndexSpec[] = [
  {
    key: { threadId: 1 },
    unique: true 
  }
];

export const memoryDocumentSchema = z
  .object({
    threadId: z.string().min(1),
    summary: z.string(),
    tokenCount: z.number().int().nonnegative(),
    version: z.number().int().positive(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strip();

export type MemoryDocument = z.infer<typeof memoryDocumentSchema>;

/** Read mapper: validates the stored body and lifts `_id` to the boundary `id`. */
export const toMemory = (doc: WithId<MemoryDocument>): Memory => {
  const {
    _id, ...rest 
  } = doc;
  return {
    id: _id.toString(),
    ...memoryDocumentSchema.parse(rest),
  };
};
