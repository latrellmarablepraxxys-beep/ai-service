import type { RequestHandler } from 'express';

import type { MetricsSnapshot } from '../../../interfaces/http.js';
import { getMetrics, metrics } from '../../../utils/metrics.js';

export interface MetricsControllerDependencies {
  metrics?: MetricsSnapshot;
}

const defaultMetricsSnapshot: MetricsSnapshot = {
  contentType: metrics.register.contentType,
  render: getMetrics,
};

export const createMetricsController = (
  dependencies: MetricsControllerDependencies,
): RequestHandler => {
  const metricsSnapshot = dependencies.metrics ?? defaultMetricsSnapshot;

  return async (_req, res) => {
    res.type(metricsSnapshot.contentType).send(await metricsSnapshot.render());
  };
};
