import { mockAdminApiConfig } from '../src/config/mockAdminApi.js';
import { createMockAdminApp } from '../src/mock/MockAdminApp.js';
import { logger } from '../src/utils/logger.js';

/**
 * Runs the mock of the Laravel admin's `/api/v1` on its own port.
 *
 * Usage: `npm run mock:admin`
 * Point the service at it with `DOMAIN_API_URL=http://localhost:<port>/api/v1`.
 */
const start = (): void => {
  const app = createMockAdminApp();
  const server = app.listen(mockAdminApiConfig.port, () => {
    logger.info({
      port: mockAdminApiConfig.port,
      baseUrl: `http://localhost:${mockAdminApiConfig.port}/api/v1`,
    }, 'mock admin API listening');
  });

  server.on('error', (error) => {
    logger.error({ err: error }, 'mock admin API server error');
    process.exit(1);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'mock admin API shutting down');
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start();
