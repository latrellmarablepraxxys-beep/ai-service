import express, { type Express } from 'express';

import { sendError } from './responses.js';
import { createMockAdminRouter } from './routes.js';

/**
 * Builds the standalone mock admin app. Mounted on its own port so it never
 * collides with this service's own `/api/v1` routes. Errors use the admin's
 * envelope, not this service's.
 */
export const createMockAdminApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  // Laravel accepts `brand[]=HONDA`; the extended parser reproduces that.
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use('/api/v1', createMockAdminRouter());
  app.use((_req, res) => {
    sendError(res, 'Resource Not Found', 404);
  });

  return app;
};
