import { ObjectId } from 'mongodb';

import type { PaginatedResult, PaginationParams } from '../../interfaces/persistence.js';
import { AppError, isAppError } from '../../utils/errors.js';

const DUPLICATE_KEY_CODE = 11000;
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

const hasCode = (error: unknown): error is { code: unknown } =>
  typeof error === 'object' && error !== null && 'code' in error;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const nowIso = (): string => new Date().toISOString();

export const notFoundError = (message: string): AppError =>
  new AppError('PERSISTENCE_NOT_FOUND', 404, message);

/** Normalizes driver failures into port error codes, preserving the original cause. */
export const toPersistenceError = (error: unknown, message: string): AppError => {
  if (isAppError(error)) return error;

  if (hasCode(error) && error.code === DUPLICATE_KEY_CODE) {
    return new AppError('PERSISTENCE_DUPLICATE_KEY', 409, message, { cause: errorMessage(error) });
  }

  return new AppError('PERSISTENCE_QUERY_ERROR', 500, message, { cause: errorMessage(error) });
};

/** Boundary ids are strings; invalid ids cannot match a document. */
export const toObjectId = (id: string): ObjectId | null =>
  ObjectId.isValid(id) ? new ObjectId(id) : null;

export const resolvePagination = (params?: PaginationParams) => {
  // Clamp to [1, 100]: the driver rejects negative skip, perPage 0 yields an
  // empty slice, and the HTTP boundary enforces the same 100 cap. Defaults stay
  // page 1 / perPage 50 for direct repository calls.
  const page = Math.max(1, params?.page ?? DEFAULT_PAGE);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, params?.perPage ?? DEFAULT_PER_PAGE));
  return {
    page,
    perPage,
    skip: (page - 1) * perPage,
    limit: perPage 
  };
};

export const toPaginatedResult = <T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
): PaginatedResult<T> => ({
    items,
    total,
    page,
    perPage,
    hasNextPage: page * perPage < total,
  });
