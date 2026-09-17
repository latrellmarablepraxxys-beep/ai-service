import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { errorHandler } from './api/http/middleware/ErrorHandler.js';
import { notFound } from './api/http/middleware/NotFound.js';
import { createRateLimiter } from './api/http/middleware/RateLimit.js';
import { requestLogger } from './api/http/middleware/RequestLogger.js';
import { createHttpRouter } from './api/http/routes.js';
import { appConfig } from './config/app.js';
import type { AppDependencies } from './interfaces/http.js';

const JSON_BODY_LIMIT = '1mb';

/**
 * Maps the `TRUST_PROXY` env string to Express's `trust proxy` value: '' leaves
 * it unset (direct connections), 'true'/'false' become booleans, anything else
 * (e.g. a hop count) is passed through as-is.
 */
const resolveTrustProxy = (value: string): boolean | string | undefined => {
  if (value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

/**
 * Builds the Express app from injected dependencies. No `listen` here — the
 * bootstrap (`src/index.ts`) owns the lifecycle, tests import this directly.
 */
export const buildExpressApp = (dependencies: AppDependencies): Express => {
  const app = express();

  app.disable('x-powered-by');

  const trustProxy = resolveTrustProxy(appConfig.trustProxy);
  if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }

  app.use(helmet());
  app.use(cors({
    origin: appConfig.frontendUrl,
    credentials: true 
  }));
  // Logger first so malformed-JSON rejections from express.json still get a line.
  app.use(requestLogger);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(createRateLimiter());

  app.use(createHttpRouter(dependencies));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
