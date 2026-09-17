import { Router } from 'express';

import type { AppDependencies } from '../../../interfaces/http.js';
import { createHealthController } from '../controllers/HealthController.js';
import { createMetricsController } from '../controllers/MetricsController.js';

export const createSystemRouter = (dependencies: AppDependencies): Router => {
  const router = Router();

  router.get('/health', createHealthController(dependencies));
  router.get('/metrics', createMetricsController(dependencies));

  return router;
};
