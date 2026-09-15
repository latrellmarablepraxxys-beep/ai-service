import type { Request, Response } from 'express';

import { AppError, toErrorResponse } from '../../../utils/errors.js';

/** Terminal 404 middleware — produces the standard error envelope. */
export const notFound = (_req: Request, res: Response): void => {
  const error = new AppError('NOT_FOUND', 404, 'Route not found');
  res.status(error.status).json(toErrorResponse(error));
};
