import { Router } from 'express';

import type { AppDependencies } from '../../interfaces/http.js';
import { createSystemRouter } from './routers/SystemRouter.js';
import { createV1Router } from './routers/V1Router.js';

/**
 * HTTP composition root: one mount per audience. Ops routes (health, metrics)
 * are unprefixed; the versioned admin API lives under `/api/v1`.
 */
export const createHttpRouter = (dependencies: AppDependencies): Router => {
  const router = Router();
  router.use(createSystemRouter(dependencies));
  router.use('/api/v1', createV1Router(dependencies));
  return router;
};
