import {
  describe, expect, it 
} from 'vitest';

import {
  AppError, isAppError, toErrorResponse 
} from '@utils/errors.js';

describe('AppError',
  () => {
    it('exposes code, status, and message',
      () => {
        const error = new AppError('WEBHOOK_INVALID_SIGNATURE', 401, 'Signature check failed');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('AppError');
        expect(error.code).toBe('WEBHOOK_INVALID_SIGNATURE');
        expect(error.status).toBe(401);
        expect(error.message).toBe('Signature check failed');
      });

    it('defaults the message to the code',
      () => {
        const error = new AppError('RATE_LIMITED', 429);

        expect(error.message).toBe('RATE_LIMITED');
      });

    it('carries optional details',
      () => {
        const error = new AppError('VALIDATION_FAILED', 422, 'Bad input', { field: 'email' });

        expect(error.details).toEqual({ field: 'email' });
      });
  });

describe('isAppError',
  () => {
    it('returns true for AppError instances',
      () => {
        expect(isAppError(new AppError('X', 400))).toBe(true);
      });

    it('returns false for plain errors and unknowns',
      () => {
        expect(isAppError(new Error('x'))).toBe(false);
        expect(isAppError('nope')).toBe(false);
        expect(isAppError(undefined)).toBe(false);
      });
  });

describe('toErrorResponse',
  () => {
    it('maps an AppError including details',
      () => {
        const error = new AppError('WEBHOOK_INVALID_SIGNATURE',
          401,
          'Bad signature',
          {eventId: 'evt_1',});

        expect(toErrorResponse(error)).toEqual({
          success: false,
          error: {
            code: 'WEBHOOK_INVALID_SIGNATURE',
            message: 'Bad signature',
            details: { eventId: 'evt_1' },
          },
        });
      });

    it('keeps details on a client-facing 4xx AppError',
      () => {
        const error = new AppError('VALIDATION_FAILED', 422, 'Bad input', { field: 'email' });

        expect(toErrorResponse(error).error).toEqual({
          code: 'VALIDATION_FAILED',
          message: 'Bad input',
          details: { field: 'email' },
        });
      });

    it('strips upstream cause details even on a 4xx AppError',
      () => {
        const error = new AppError('SEARCH_NOT_FOUND',
          404,
          'Typesense search failed',
          {cause: 'getaddrinfo ENOTFOUND typesense.internal',});

        expect(toErrorResponse(error).error).toEqual({
          code: 'SEARCH_NOT_FOUND',
          message: 'Typesense search failed',
        });
      });

    it('keeps safe details while stripping cause on a 4xx AppError',
      () => {
        const error = new AppError('VALIDATION_FAILED',
          422,
          'Bad input',
          {
            field: 'email',
            cause: 'upstream said no',
          });

        expect(toErrorResponse(error).error.details).toEqual({ field: 'email' });
      });

    it('omits details on a 5xx AppError so upstream causes never leak',
      () => {
        const error = new AppError('CACHE_ERROR',
          500,
          'Cache get failed',
          {cause: 'getaddrinfo ENOTFOUND redis.internal',});

        expect(toErrorResponse(error).error).toEqual({
          code: 'CACHE_ERROR',
          message: 'Cache get failed',
        });
      });

    it('omits details when the AppError has none',
      () => {
        const response = toErrorResponse(new AppError('NOT_FOUND', 404, 'Ticket not found'));

        expect(response.error).toEqual({
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        });
      });

    it('maps a plain Error to a static INTERNAL_ERROR message',
      () => {
        const response = toErrorResponse(new Error('boom'));

        expect(response).toEqual({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error' 
          },
        });
      });

    it('does not leak an arbitrary error message from a non-Error throw',
      () => {
        const response = toErrorResponse({ message: 'mongodb://user:pass@db:27017' });

        expect(response).toEqual({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error' 
          },
        });
      });
  });
