/**
 * MongoDB collection registry + index specifications.
 *
 * Single source of truth for the collections this service owns and the indexes
 * they require. Consumed by the repositories (collection names) and by
 * `scripts/initMongo.ts` (collection + index bootstrap).
 */

import type { CollectionName, IndexSpec } from '../../interfaces/mongo.js';

export const COLLECTIONS = Object.freeze({
  threads: 'threads',
  messages: 'messages',
  memories: 'memories',
  runs: 'runs',
} as const) satisfies Record<CollectionName, CollectionName>;

export const COLLECTION_INDEXES: Readonly<Record<CollectionName, IndexSpec[]>> = Object.freeze({
  threads: [
    {
      key: { ticketId: 1 },
      unique: true 
    },
    { key: { status: 1 } },
    { key: { updatedAt: -1 } },
  ],
  messages: [
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
  ],
  memories: [
    {
      key: { threadId: 1 },
      unique: true 
    }
  ],
  runs: [
    {
      key: {
        threadId: 1,
        startedAt: -1 
      } 
    },
    {
      key: {
        type: 1,
        status: 1 
      } 
    }
  ],
});
