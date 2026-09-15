import { appConfig } from '../../config/app.js';
import type { CacheClient, HealthStatus } from '../../interfaces/cache.js';
import type { CreateRedisCacheClientOptions } from '../../interfaces/redis.js';
import { AppError, isAppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const CONNECTION_ERROR_CODES = /^(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)/;

const isConnectionError = (error: Error): boolean =>
  'code' in error && typeof error.code === 'string' && CONNECTION_ERROR_CODES.test(error.code);

/** ioredis reports command timeouts with these messages (see `commandTimeout`). */
const isTimeoutError = (error: Error): boolean =>
  error.message.includes('Command timed out') || error.message.includes('commandTimeout');

/** Maps any thrown value to an AppError, preserving timeout vs. connection vs. client errors. */
const toAppError = (error: unknown, message: string): AppError => {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    if (isTimeoutError(error)) {
      return new AppError('CACHE_TIMEOUT', 504, message, { cause: error.message });
    }
    if (isConnectionError(error)) {
      return new AppError('CACHE_CONNECTION_ERROR', 503, message, { cause: error.message });
    }
    return new AppError('CACHE_ERROR', 500, message, { cause: error.message });
  }
  return new AppError('CACHE_ERROR', 500, message);
};

export const createRedisCacheClient = (options: CreateRedisCacheClientOptions): CacheClient => {
  const namespace = options.namespace ?? `${appConfig.name}:cache:`;
  const { client } = options;

  const keyFor = (key: string): string => `${namespace}${key}`;

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const raw = await client.get(keyFor(key));
        if (raw === null) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          throw new AppError('CACHE_ERROR', 500, `Failed to deserialize cached value for "${key}"`);
        }
      } catch (error) {
        throw toAppError(error, `Cache get failed for "${key}"`);
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      try {
        await client.set(keyFor(key), JSON.stringify(value));
      } catch (error) {
        throw toAppError(error, `Cache set failed for "${key}"`);
      }
    },

    async withTtl<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      try {
        await client.set(keyFor(key), JSON.stringify(value), 'EX', ttlSeconds);
      } catch (error) {
        throw toAppError(error, `Cache set failed for "${key}"`);
      }
    },

    async del(key: string): Promise<void> {
      try {
        await client.del(keyFor(key));
      } catch (error) {
        throw toAppError(error, `Cache delete failed for "${key}"`);
      }
    },

    async has(key: string): Promise<boolean> {
      try {
        return (await client.exists(keyFor(key))) === 1;
      } catch (error) {
        throw toAppError(error, `Cache exists check failed for "${key}"`);
      }
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
        logger.warn({ err: error }, 'Redis cache health check failed');
        return {
          connected: false,
          latencyMs: undefined 
        };
      }
    },
  };
};
