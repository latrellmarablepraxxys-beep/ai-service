import type {
  NextFunction, Request, Response 
} from 'express';
import {
  describe, expect, it, vi 
} from 'vitest';

import { createApiKeyAuth } from '@api/http/middleware/ApiKeyAuth.js';
import type { ErrorResponse } from '@interfaces/errors.js';

const invoke = (keys: string[], provided: string | undefined) => {
  const middleware = createApiKeyAuth({ keys });
  const req = { header: vi.fn().mockReturnValue(provided) } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  middleware(req, res, next);

  return {
    json,
    status,
    next,
  };
};

describe('createApiKeyAuth',
  () => {
    it('calls next for a matching key',
      () => {
        const {
          status, next 
        } = invoke(['secret-key'], 'secret-key');

        expect(next).toHaveBeenCalledTimes(1);
        expect(status).not.toHaveBeenCalled();
      });

    it('accepts any key from a rotating set',
      () => {
        const {
          status, next 
        } = invoke([
          'old-key',
          'new-key'
        ], 'new-key');

        expect(next).toHaveBeenCalledTimes(1);
        expect(status).not.toHaveBeenCalled();
      });

    it('rejects a missing key with 401',
      () => {
        const {
          status, json, next 
        } = invoke(['secret-key'], undefined);

        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(401);
        expect((json.mock.calls[0]?.[0] as ErrorResponse).error.code).toBe('UNAUTHORIZED');
      });

    it('rejects a wrong key with 401',
      () => {
        const {
          status, next 
        } = invoke(['secret-key'], 'nope');

        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(401);
      });

    it('fails closed when no keys are configured',
      () => {
        const {
          status, next 
        } = invoke([], 'anything');

        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(401);
      });
  });
