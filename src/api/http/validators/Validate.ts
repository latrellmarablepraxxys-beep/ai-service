import type { RequestHandler } from 'express';
import type { ZodIssue } from 'zod';

import type { ValidatorOptions } from '../../../interfaces/http.js';
import { AppError } from '../../../utils/errors.js';

const flattenIssues = (issues: ZodIssue[]): Record<string, string[]> => {
  const fields: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join('.');
    const messages = fields[key] ?? [];
    messages.push(issue.message);
    fields[key] = messages;
  }
  return fields;
};

export const createValidator = (options: ValidatorOptions): RequestHandler => {
  const { schema } = options;

  return (req, _res, next) => {
    const result = schema.safeParse(req[options.source]);

    if (!result.success) {
      next(
        new AppError('VALIDATION_ERROR',
          422,
          'Validation failed',
          {fields: flattenIssues(result.error.issues),}),
      );
      return;
    }

    Object.defineProperty(req,
      options.source,
      {
        value: result.data as unknown,
        writable: true,
        configurable: true,
        enumerable: true,
      });

    next();
  };
};
