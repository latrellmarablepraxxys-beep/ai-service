import type { Db } from 'mongodb';
import { MongoClient as RealMongoClient } from 'mongodb';

import { mongodbConfig } from '../../config/mongodb.js';
import type { CreateMongoConnectionOptions, MongoConnection } from '../../interfaces/mongo.js';
import type { HealthStatus } from '../../interfaces/persistence.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const createMongoConnection = (
  options: CreateMongoConnectionOptions = {},
): MongoConnection => {
  const client = options.client ?? new RealMongoClient(options.uri ?? mongodbConfig.uri);
  const dbName = options.dbName ?? mongodbConfig.dbName;
  let connected = false;

  const getDb = (): Db => {
    if (!connected) {
      throw new AppError('PERSISTENCE_CONNECTION_ERROR', 503, 'MongoDB is not connected');
    }
    return client.db(dbName);
  };

  return {
    async connect(): Promise<void> {
      await client.connect();
      connected = true;
      // Never log the URI: it may contain credentials.
      logger.info({ dbName }, 'MongoDB connected');
    },

    getDb,

    async close(): Promise<void> {
      if (!connected) {
        return; // never connected — no-op (client.close() rejects when never connected)
      }
      await client.close();
      connected = false;
    },

    async health(): Promise<HealthStatus> {
      const start = performance.now();
      try {
        await getDb().command({ ping: 1 });
        return {
          connected: true,
          latencyMs: Math.round(performance.now() - start) 
        };
      } catch (error) {
        logger.warn({ err: error }, 'MongoDB health check failed');
        return {
          connected: false,
          latencyMs: undefined 
        };
      }
    },
  };
};
