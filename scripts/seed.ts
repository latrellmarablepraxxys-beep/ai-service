/**
 * Local seed entrypoint.
 *
 * This service owns only conversation state (MongoDB); tickets/agents/SLA are
 * owned by the Laravel admin and must be seeded there. No seed dataset is
 * bundled, so the script never writes: it verifies the Mongo connection and
 * reports the document counts for the collections this service owns. Refuses to
 * run in production.
 *
 * Usage: npm run db:seed
 */
import { appConfig } from '../src/config/app.js';
import { mongodbConfig } from '../src/config/mongodb.js';
import type { CollectionName } from '../src/interfaces/mongo.js';
import { COLLECTIONS } from '../src/persistence/models/Collections.js';
import { createMongoConnection } from '../src/services/mongodb/MongoConnection.js';
import { logger } from '../src/utils/logger.js';

const seed = async (): Promise<void> => {
  if (appConfig.isProd) {
    throw new Error('db:seed is local-only and must not run in production');
  }

  const connection = createMongoConnection({});
  await connection.connect();

  try {
    const db = connection.getDb();
    const counts: Partial<Record<CollectionName, number>> = {};

    for (const name of Object.values(COLLECTIONS)) {
      counts[name] = await db.collection(name).countDocuments();
    }

    logger.info({
      database: mongodbConfig.dbName,
      counts
    }, 'No seed dataset bundled; database left unchanged');
    logger.info(
      'Seed tickets/agents/SLA through the Laravel admin API; this service owns conversation state only',
    );
  } finally {
    await connection.close();
  }
};

seed().catch((error: unknown) => {
  logger.error({ err: error }, 'Database seeding failed');
  process.exitCode = 1;
});
