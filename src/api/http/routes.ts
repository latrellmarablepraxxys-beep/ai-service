import { Router } from 'express';

import type { HealthStatus } from '../../interfaces/cache.js';
import type {
  AppDependencies,
  HealthResponse,
  HealthState,
  MetricsSnapshot,
} from '../../interfaces/http.js';
import { getMetrics, metrics } from '../../utils/metrics.js';

const defaultMetricsSnapshot: MetricsSnapshot = {
  contentType: metrics.register.contentType,
  render: getMetrics,
};

/** Collapses a settled probe into a status; a rejection degrades instead of 500ing. */
const toHealthStatus = (result: PromiseSettledResult<HealthStatus>): HealthStatus =>
  result.status === 'fulfilled' ? result.value : {
    connected: false,
    latencyMs: undefined 
  };

/**
 * Single route table for the HTTP app. Callers pass real probes in production
 * and stubs in tests. Kept as a factory so future routes stay grouped here.
 */
export const createHttpRouter = (dependencies: AppDependencies): Router => {
  const router = Router();
  const metricsSnapshot = dependencies.metrics ?? defaultMetricsSnapshot;

  router.get('/health',
    async (_req, res) => {
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
    });

  router.get('/metrics',
    async (_req, res) => {
      res.type(metricsSnapshot.contentType).send(await metricsSnapshot.render());
    });

  return router;
};
