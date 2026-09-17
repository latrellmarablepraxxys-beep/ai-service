import type { RequestHandler } from 'express';

import type { HealthStatus } from '../../../interfaces/cache.js';
import type {
  HealthProbe,
  HealthResponse,
  HealthState,
} from '../../../interfaces/http.js';

export interface HealthControllerDependencies {
  mongoHealth: HealthProbe;
  redisHealth: HealthProbe;
  typesenseHealth: HealthProbe;
  llmHealth: HealthProbe;
}

/** Collapses a settled probe into a status; a rejection degrades instead of 500ing. */
const toHealthStatus = (result: PromiseSettledResult<HealthStatus>): HealthStatus =>
  result.status === 'fulfilled' ? result.value : {
    connected: false,
    latencyMs: undefined 
  };

export const createHealthController = (
  dependencies: HealthControllerDependencies,
): RequestHandler => {
  return async (_req, res) => {
    const [
      mongo,
      redis,
      typesense,
      llm
    ] = await Promise.allSettled([
      dependencies.mongoHealth(),
      dependencies.redisHealth(),
      dependencies.typesenseHealth(),
      dependencies.llmHealth(),
    ]);

    const checks = {
      mongo: toHealthStatus(mongo),
      redis: toHealthStatus(redis),
      typesense: toHealthStatus(typesense),
      llm: toHealthStatus(llm),
    };

    const status: HealthState =
      checks.mongo.connected &&
      checks.redis.connected &&
      checks.typesense.connected &&
      checks.llm.connected
        ? 'ok'
        : 'degraded';

    const body: HealthResponse = {
      status,
      checks 
    };
    res.status(status === 'ok' ? 200 : 503).json(body);
  };
};
