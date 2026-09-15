import type {
  NextFunction, Request, Response 
} from 'express';

import { childLogger } from '../../../utils/logger.js';

/**
 * Logs one line per request on `finish` (method/path/status/durationMs).
 * Never logs bodies or headers. `req.path` excludes the query string, which may
 * carry secrets/tokens.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = performance.now();
  const log = childLogger({
    method: req.method,
    path: req.path 
  });

  res.on('finish', () => {
    log.info({
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    }, 'request completed');
  });

  next();
};
