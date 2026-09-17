/**
 * Drops the service-owned MongoDB collections, then recreates them and their
 * indexes — the MongoDB equivalent of Laravel's `migrate:fresh`. Refuses to run
 * in production and requires `--force`.
 *
 * Usage: npm run db:fresh -- --force
 */
import type { Db } from 'mongodb';

import { COLLECTIONS } from '../src/persistence/models/Collections.js';
import { logger } from '../src/utils/logger.js';
import { createIndexes } from './createIndexes.js';
import { initCollections } from './initCollections.js';
import {
  assertDestructiveAllowed,
  dropCollection,
  withMongoConnection
} from './mongoHelpers.js';

/** Drops each service-owned collection, then recreates collections + indexes. */
export const freshDatabase = async (db: Db): Promise<void> => {
  for (const name of Object.values(COLLECTIONS)) {
    const dropped = await dropCollection(db, name);
    logger.info({
      collection: name,
      dropped
    }, 'Collection dropped');
  }

  await initCollections(db);
  await createIndexes(db);

  logger.info({ collections: Object.values(COLLECTIONS) }, 'MongoDB recreated fresh');
};

const main = async (): Promise<void> => {
  assertDestructiveAllowed('db:fresh');
  await withMongoConnection((db) => freshDatabase(db));
};

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Database fresh failed');
  process.exitCode = 1;
});
