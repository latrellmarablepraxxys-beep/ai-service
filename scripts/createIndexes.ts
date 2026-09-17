/**
 * Idempotent MongoDB index bootstrap: ensures every declared index exists on
 * the collections this service owns. Safe to re-run.
 *
 * Usage: npm run db:create-indexes
 */
import type { Db } from 'mongodb';

import type { CollectionName } from '../src/interfaces/mongo.js';
import { COLLECTION_INDEXES, COLLECTIONS } from '../src/persistence/models/Collections.js';
import { logger } from '../src/utils/logger.js';
import { withMongoConnection } from './mongoHelpers.js';

export const createIndexes = async (db: Db): Promise<Record<CollectionName, string[]>> => {
  const result = {} as Record<CollectionName, string[]>;

  for (const name of Object.values(COLLECTIONS)) {
    const names = await db.collection(name).createIndexes(COLLECTION_INDEXES[name]);
    logger.info({
      collection: name,
      indexes: names
    }, 'Indexes ensured');

    result[name] = names;
  }

  return result;
};

withMongoConnection((db) => createIndexes(db))
  .then((indexes) => {
    logger.info({
      ...indexes,
      total: Object.values(COLLECTIONS).length
    }, 'MongoDB indexes ensured');
  })
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Index creation failed');
    process.exitCode = 1;
  });
