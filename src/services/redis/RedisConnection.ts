import type { Redis } from 'ioredis';
import { Redis as RedisClient, type RedisOptions } from 'ioredis';

import { redisConfig } from '../../config/redis.js';
import type { HealthStatus } from '../../interfaces/cache.js';
import type {
  CreateRedisConnectionOptions,
  RedisConnection,
  RedisProfile,
} from '../../interfaces/redis.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const connectionOptions = (profile: RedisProfile): RedisOptions =>
  profile === 'cache'
    ? {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: redisConfig.commandTimeoutMs,
      lazyConnect: true,
    }
    : {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };

export const createRedisConnection = (
  options: CreateRedisConnectionOptions = {},
): RedisConnection => {
  // maxRetriesPerRequest: null is required by BullMQ; lazyConnect delays the
  // handshake until connect() so failures surface as AppErrors, not at import.
  const client =
    options.client ??
    new RedisClient(options.url ?? redisConfig.url, connectionOptions(options.profile ?? 'queue'));
  let connected = false;

  const getClient = (): Redis => {
    if (!connected) {
      throw new AppError('CACHE_CONNECTION_ERROR', 503, 'Redis is not connected');
    }
    return client;
  };

  return {
    async connect(): Promise<void> {
      await client.connect();
      connected = true;
      logger.info('Redis connected');
    },

    getClient,

    async close(): Promise<void> {
      if (!connected) {
        return; // never connected — quit() on a lazy/unconnected client can reject
      }
      await client.quit();
      connected = false;
    },

    async health(): Promise<HealthStatus> {
      const start = performance.now();
      try {
        await client.ping();
        return {
          connected: true,
          latencyMs: Math.round(performance.now() - start) 
        };
      } catch (error) {
        logger.warn({ err: error }, 'Redis health check failed');
        return {
          connected: false,
          latencyMs: undefined 
        };
      }
    },
  };
};
