import type { ErrorDetails, ErrorResponse } from '../interfaces/errors.js';

export type { ErrorDetails, ErrorResponse } from '../interfaces/errors.js';

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ErrorDetails | undefined;

  constructor(code: string, status: number, message?: string, details?: ErrorDetails) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

/**
 * Static fallback for unexpected failures. Arbitrary `Error.message` values leak
 * upstream internals (Mongo/ioredis/Typesense hostnames and paths), so they are
 * never echoed to clients — the real error is logged server-side instead.
 */
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/**
 * Detail keys that carry upstream internals (hostnames, ports, file paths).
 * Adapters seed `details.cause` with `error.message`, so it is always stripped
 * from the client response regardless of status code.
 */
const SENSITIVE_DETAIL_KEYS: readonly string[] = ['cause'];

const sanitizeDetails = (details: ErrorDetails | undefined): ErrorDetails | undefined => {
  if (details === undefined) return undefined;

  const sanitized: ErrorDetails = {};
  for (const [
    key,
    value
  ] of Object.entries(details)) {
    if (!SENSITIVE_DETAIL_KEYS.includes(key)) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export function toErrorResponse(error: unknown): ErrorResponse {
  if (isAppError(error)) {
    const {
      code, status, message 
    } = error;
    // Details are only useful (and safe) for client-facing 4xx responses, and
    // never include upstream `cause` strings.
    const details = status >= 500 ? undefined : sanitizeDetails(error.details);
    if (details === undefined) {
      return {
        success: false,
        error: {
          code,
          message 
        } 
      };
    }
    return {
      success: false,
      error: {
        code,
        message,
        details 
      } 
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: INTERNAL_ERROR_MESSAGE 
    },
  };
}
