import type { Db } from 'mongodb';

import type {
  EntityId,
  Memory,
  MemoryRepository,
  UpsertMemoryInput,
} from '../../interfaces/persistence.js';
import { AppError } from '../../utils/errors.js';
import {
  MEMORY_COLLECTION, toMemory, type MemoryDocument 
} from '../models/Memory.js';
import { nowIso, toPersistenceError } from './Helpers.js';

export const createMemoryRepository = (db: Db): MemoryRepository => {
  const memories = db.collection<MemoryDocument>(MEMORY_COLLECTION);

  return {
    async upsert(input: UpsertMemoryInput): Promise<Memory> {
      const timestamp = nowIso();
      const filter = { threadId: input.threadId };

      try {
        await memories.updateOne(
          filter,
          {
            $set: {
              summary: input.summary,
              tokenCount: input.tokenCount,
              updatedAt: timestamp,
            },
            $setOnInsert: {
              threadId: input.threadId,
              createdAt: timestamp,
            },
            $inc: { version: 1 },
          },
          { upsert: true },
        );

        const doc = await memories.findOne(filter);
        if (!doc) {
          throw new AppError(
            'PERSISTENCE_QUERY_ERROR',
            500,
            `Memory upsert for thread "${input.threadId}" returned no document`,
          );
        }

        return toMemory(doc);
      } catch (error) {
        throw toPersistenceError(error, `Failed to upsert memory for thread "${input.threadId}"`);
      }
    },

    async findByThread(threadId: EntityId): Promise<Memory | null> {
      try {
        const doc = await memories.findOne({ threadId });
        return doc ? toMemory(doc) : null;
      } catch (error) {
        throw toPersistenceError(error, `Failed to find memory for thread "${threadId}"`);
      }
    },
  };
};
