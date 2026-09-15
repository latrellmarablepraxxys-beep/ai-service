/**
 * Idempotent MongoDB bootstrap: creates the collections this service owns and
 * ensures their indexes exist. Safe to re-run.
 *
 * Usage: npm run mongo:init
 */
import type { Db } from 'mongodb';

import { COLLECTION_INDEXES, COLLECTIONS } from '../src/persistence/models/Collections.js';
import type { CollectionName } from '../src/interfaces/mongo.js';
import { createMongoConnection } from '../src/services/mongodb/MongoConnection.js';
import { logger } from '../src/utils/logger.js';

const NAMESPACE_EXISTS_CODE = 48;

const hasCode = (error: unknown): error is { code: unknown } =>
  typeof error === 'object' && error !== null && 'code' in error;

const collectionExists = async (db: Db, name: CollectionName): Promise<boolean> =>
  db.listCollections({ name }, { nameOnly: true }).hasNext();

/** Returns true when the collection was created by this run. */
const ensureCollection = async (db: Db, name: CollectionName): Promise<boolean> => {
  if (await collectionExists(db, name)) return false;

  try {
    await db.createCollection(name);
    return true;
  } catch (error) {
    // Ignore a create/check race — the collection exists either way.
    if (hasCode(error) && error.code === NAMESPACE_EXISTS_CODE) return false;
    throw error;
  }
};

const init = async (): Promise<void> => {
  const connection = createMongoConnection({});
  await connection.connect();

  try {
    const db = connection.getDb();
    const created: string[] = [];
    const existing: string[] = [];

    for (const name of Object.values(COLLECTIONS)) {
      const isNew = await ensureCollection(db, name);
      (isNew ? created : existing).push(name);

      const indexes = await db.collection(name).createIndexes(COLLECTION_INDEXES[name]);
      logger.info({
        collection: name,
        indexes
      }, 'Indexes ensured');
    }

    logger.info({
      created,
      existing,
      total: Object.values(COLLECTIONS).length
    }, 'MongoDB initialization complete');
  } finally {
    await connection.close();
  }
};

init().catch((error: unknown) => {
  logger.error({ err: error }, 'MongoDB initialization failed');
  process.exitCode = 1;
});
