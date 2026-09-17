import { createHash, timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

import { aiApiConfig } from '../../../config/aiApi.js';
import type { ApiKeyAuthOptions } from '../../../interfaces/http.js';
import { AppError, toErrorResponse } from '../../../utils/errors.js';

const API_KEY_HEADER = 'x-api-key';

/** Hashes to a fixed-length digest so the compare never leaks key length. */
const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Guards routes with a shared API key presented as `X-Api-Key`. Keys come from
 * `AI_API_KEYS` (comma-separated, supporting rotation) unless overridden.
 * Fails closed: an empty key set rejects every request.
 */
export const createApiKeyAuth = (options: ApiKeyAuthOptions = {}): RequestHandler => {
  const keyDigests = (options.keys ?? aiApiConfig.apiKeys).map(digest);

  return (req, res, next) => {
    const provided = req.header(API_KEY_HEADER);
    const providedDigest = provided === undefined ? undefined : digest(provided);

    const authorized =
      providedDigest !== undefined &&
      keyDigests.some((keyDigest) => timingSafeEqual(keyDigest, providedDigest));

    if (!authorized) {
      const error = new AppError('UNAUTHORIZED', 401, 'Invalid or missing API key');
      res.status(error.status).json(toErrorResponse(error));
      return;
    }

    next();
  };
};
