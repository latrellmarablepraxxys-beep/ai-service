import type { RequestHandler } from 'express';

import { sendValidationError } from '../responses.js';

const ALLOWED_PLATFORMS: ReadonlySet<string> = new Set([
  'web',
  'mobile'
]);

/**
 * Mirrors the admin's `RequiresPlatform` middleware: `X-Platform-Access` must
 * be `web` or `mobile`. A failure is a Laravel-shaped 422 validation response.
 */
export const mockRequiresPlatform: RequestHandler = (req, res, next) => {
  const platform = req.header('x-platform-access');

  if (platform === undefined || !ALLOWED_PLATFORMS.has(platform)) {
    sendValidationError(res, 'Invalid platform provided.');
    return;
  }

  next();
};
