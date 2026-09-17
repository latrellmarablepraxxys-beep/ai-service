/**
 * MongoDB connectivity check: opens the configured connection, runs a `ping`
 * against the database, and exits non-zero when unreachable.
 *
 * Usage: npm run db:ping
 */
import { mongodbConfig } from '../src/config/mongodb.js';
import { createMongoConnection } from '../src/services/mongodb/MongoConnection.js';
import { logger } from '../src/utils/logger.js';

const ping = async (): Promise<void> => {
  const connection = createMongoConnection({});
  await connection.connect();

  try {
    const health = await connection.health();
    if (!health.connected) {
      logger.error({ database: mongodbConfig.dbName }, 'MongoDB ping failed');
      process.exitCode = 1;
      return;
    }

    logger.info({
      database: mongodbConfig.dbName,
      latencyMs: health.latencyMs 
    }, 'MongoDB ping OK');
  } finally {
    await connection.close();
  }
};

ping().catch((error: unknown) => {
  logger.error({ err: error }, 'MongoDB ping failed');
  process.exitCode = 1;
});
