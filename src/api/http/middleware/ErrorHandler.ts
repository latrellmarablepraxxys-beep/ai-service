import type {
  NextFunction, Request, Response 
} from 'express';

import {
  AppError, isAppError, toErrorResponse 
} from '../../../utils/errors.js';
import { childLogger } from '../../../utils/logger.js';

/** `express.json` rejects malformed bodies with a `SyntaxError` tagged by body-parser. */
const isMalformedJsonError = (error: unknown): boolean =>
  error instanceof SyntaxError && (error as { type?: unknown }).type === 'entity.parse.failed';

/** `express.json` rejects bodies over `JSON_BODY_LIMIT` with a 413 tagged by body-parser. */
const isOversizeJsonError = (error: unknown): boolean =>
  error instanceof Error && (error as { type?: unknown }).type === 'entity.too.large';

const toAppError = (error: unknown): AppError => {
  if (isAppError(error)) return error;
  if (isMalformedJsonError(error)) {
    return new AppError('INVALID_JSON', 400, 'Malformed JSON body');
  }
  if (isOversizeJsonError(error)) {
    return new AppError('PAYLOAD_TOO_LARGE', 413, 'Request body exceeds the 1mb limit');
  }
  return new AppError('INTERNAL_ERROR', 500);
};

/**
 * The single Express error handler. Maps any thrown value via `toErrorResponse`
 * and uses `AppError.status` (default 500) for the HTTP status.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Once headers are flushed (e.g. an SSE stream already started) we can no
  // longer write a status/body — delegate to Express's default handling.
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = toAppError(error);
  const errorResponse = toErrorResponse(appError);

  const log = childLogger({
    code: errorResponse.error.code,
    status: appError.status,
    method: req.method,
    path: req.path,
  });
  if (appError.status >= 500) {
    log.error({ err: error }, 'request failed');
  } else {
    log.warn({ err: error }, 'request rejected');
  }

  res.status(appError.status).json(errorResponse);
};
