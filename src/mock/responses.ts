import type { Response } from 'express';

import type {
  MockErrorResponse,
  MockPaginationMeta,
  MockSuccessResponse,
  MockValidationErrorResponse,
} from '../interfaces/mockAdminApi.js';

/** Admin success envelope: `{ success: true, data, message, meta? }`. */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string,
  meta?: MockPaginationMeta,
): void => {
  const body: MockSuccessResponse<T> = {
    success: true,
    data,
    message,
    ...(meta === undefined ? {} : { meta }),
  };
  res.status(200).json(body);
};

/** Admin error envelope: `{ error, status }`. */
export const sendError = (res: Response, message: string, status: number): void => {
  const body: MockErrorResponse = {
    error: message,
    status,
  };
  res.status(status).json(body);
};

/** Admin unauthorized envelope: `{ error }` with HTTP 401. */
export const sendUnauthorized = (res: Response): void => {
  const body: MockErrorResponse = {error: 'Unauthorized or invalid key detected. Failed to access content.',};
  res.status(401).json(body);
};

/** Admin/Laravel validation envelope: `{ message, errors }` with HTTP 422. */
export const sendValidationError = (
  res: Response,
  message: string,
  fields?: Record<string, string[]>,
): void => {
  const body: MockValidationErrorResponse = {
    message,
    errors: fields ?? { error: [message] },
  };
  res.status(422).json(body);
};
