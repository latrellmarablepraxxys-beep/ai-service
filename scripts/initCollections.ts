/**
 * Idempotent MongoDB collection bootstrap: creates the collections this
 * service owns, skipping any that already exist. Safe to re-run.
 *
 * Usage: npm run db:init-collections
 */
import type { Db } from 'mongodb';

import type { CollectionName } from '../src/interfaces/mongo.js';
import { COLLECTIONS } from '../src/persistence/models/Collections.js';
import { logger } from '../src/utils/logger.js';
import { ensureCollection, withMongoConnection } from './mongoHelpers.js';

export const initCollections = async (
  db: Db,
): Promise<{ created: CollectionName[]; existing: CollectionName[] }> => {
  const created: CollectionName[] = [];
  const existing: CollectionName[] = [];

  for (const name of Object.values(COLLECTIONS)) {
    const isNew = await ensureCollection(db, name);
    (isNew ? created : existing).push(name);

    logger.info({ collection: name }, 'Collection ensured');
  }

  return {
    created,
    existing
  };
};

withMongoConnection((db) => initCollections(db))
  .then((summary) => {
    logger.info({
      ...summary,
      total: Object.values(COLLECTIONS).length
    }, 'MongoDB collections initialized');
  })
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Collection initialization failed');
    process.exitCode = 1;
  });
