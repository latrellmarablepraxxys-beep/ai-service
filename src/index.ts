import type { Server } from 'node:http';

import { buildExpressApp } from './app.js';
import { appConfig } from './config/app.js';
import { aiProvider } from './config/aiProviders.js';
import type { HealthStatus } from './interfaces/cache.js';
import type { AppDependencies } from './interfaces/http.js';
import { createRedisCacheClient } from './services/cache/RedisCacheClient.js';
import { createLlmProvider } from './services/llm/LlmProvider.js';
import { createMongoConnection } from './services/mongodb/MongoConnection.js';
import { createRedisConnection } from './services/redis/RedisConnection.js';
import {
  createTypesenseClient,
  createTypesenseSearchClient,
} from './services/typesense/TypesenseSearchClient.js';
import { logger } from './utils/logger.js';

/** Upper bound for each shutdown step so a hung socket/connection can't block exit. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Races a promise against a timeout, clearing the timer on settle either way. */
const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      promise,
      timeout
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

/** Promisified `server.close()` — resolves once in-flight connections drain. */
const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const start = async (): Promise<void> => {
  logger.info({ env: appConfig.env }, 'starting service');

  const mongo = createMongoConnection();
  const queueRedis = createRedisConnection({ profile: 'queue' });
  const cacheRedis = createRedisConnection({ profile: 'cache' });
  const typesense = createTypesenseSearchClient({ client: createTypesenseClient() });
  // No connection to open/close — `createLlmProvider` is lazy, models build on first use.
  const llm = createLlmProvider(aiProvider);

  // Fail fast: if any connection rejects, startup aborts before serving.
  await Promise.all([
    mongo.connect(),
    queueRedis.connect(),
    cacheRedis.connect()
  ]);
  logger.info('connections established');

  const cache = createRedisCacheClient({ client: cacheRedis.getClient() });

  /**
   * Redis is split into two profiles: the cache connection bounds retries so
   * reads fail fast, while the queue connection keeps `maxRetriesPerRequest:null`
   * for BullMQ. Health must reflect BOTH — a reachable cache with an unreachable
   * queue still means jobs cannot run.
   */
  const redisHealth = async (): Promise<HealthStatus> => {
    const [
      cacheStatus,
      queueStatus
    ] = await Promise.all([
      cache.health(),
      queueRedis.health()
    ]);
    const connected = cacheStatus.connected && queueStatus.connected;

    const latencies = [
      cacheStatus.latencyMs,
      queueStatus.latencyMs
    ].filter((latency): latency is number => latency !== undefined);

    return {
      connected,
      latencyMs: connected ? Math.max(...latencies) : undefined 
    };
  };

  const dependencies: AppDependencies = {
    mongoHealth: () => mongo.health(),
    redisHealth,
    typesenseHealth: () => typesense.health(),
    llmHealth: () => llm.health(),
  };

  const app = buildExpressApp(dependencies);
  const server = app.listen(appConfig.port, () => {
    logger.info({
      port: appConfig.port,
      baseUrl: appConfig.baseUrl 
    }, 'http server listening');
  });

  // `listen` failures (EADDRINUSE, EACCES, ...) surface as async 'error' events,
  // not rejected promises — without this the process would hang instead of exiting.
  server.on('error', (error) => {
    logger.error({ err: error }, 'http server error');
    process.exit(1);
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'shutdown started');
    try {
      await withTimeout(closeServer(server), SHUTDOWN_TIMEOUT_MS, 'http server close');
      logger.info('http server closed');

      await withTimeout(
        Promise.all([
          mongo.close(),
          queueRedis.close(),
          cacheRedis.close()
        ]),
        SHUTDOWN_TIMEOUT_MS,
        'connection close',
      );
      logger.info('connections closed');

      logger.info('shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'shutdown failed');
      process.exit(1);
    }
  };

  let shuttingDown = false;
  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      logger.warn({ signal }, 'shutdown already in progress');
      return;
    }
    shuttingDown = true;
    void shutdown(signal);
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
};

start().catch((error: unknown) => {
  logger.error({ err: error }, 'failed to start service');
  process.exit(1);
});
