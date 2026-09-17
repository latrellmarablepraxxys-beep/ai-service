/**
 * Clears documents from the service-owned MongoDB collections.
 *
 * Deletes every document while keeping the collections and their indexes in
 * place — a data reset, not a schema reset. Refuses to run in production and
 * requires `--force`.
 *
 * Usage: npm run db:clear -- --force
 */
import type { Db } from 'mongodb';

import type { CollectionName } from '../src/interfaces/mongo.js';
import { COLLECTIONS } from '../src/persistence/models/Collections.js';
import { logger } from '../src/utils/logger.js';
import { assertDestructiveAllowed, withMongoConnection } from './mongoHelpers.js';

/**
 * Deletes every document in each service-owned collection.
 *
 * @returns the number of documents deleted, keyed by collection name.
 */
export const clearDatabase = async (db: Db): Promise<Record<CollectionName, number>> => {
  const cleared: Partial<Record<CollectionName, number>> = {};

  for (const name of Object.values(COLLECTIONS)) {
    const result = await db.collection(name).deleteMany({});
    logger.info({
      collection: name,
      deleted: result.deletedCount
    }, 'Collection cleared');
    cleared[name] = result.deletedCount;
  }

  return cleared as Record<CollectionName, number>;
};

const main = async (): Promise<void> => {
  assertDestructiveAllowed('db:clear');
  const cleared = await withMongoConnection((db) => clearDatabase(db));
  logger.info({ cleared }, 'MongoDB cleared');
};

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Database clear failed');
  process.exitCode = 1;
});
