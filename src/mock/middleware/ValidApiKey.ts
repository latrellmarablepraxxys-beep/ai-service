import type { RequestHandler } from 'express';

import { mockAdminApiConfig } from '../../config/mockAdminApi.js';
import { sendUnauthorized } from '../responses.js';

/**
 * Mirrors the admin's `ValidApiKey` middleware: reads the key from the
 * `api_key` query param (preferred) or the `X-Api-Key` header and compares it
 * to the configured key. Fails closed.
 */
export const mockValidApiKey: RequestHandler = (req, res, next) => {
  const queryKey = req.query.api_key;
  const headerKey = req.header('x-api-key');
  const provided = typeof queryKey === 'string' ? queryKey : headerKey;

  if (provided !== mockAdminApiConfig.apiKey) {
    sendUnauthorized(res);
    return;
  }

  next();
};
