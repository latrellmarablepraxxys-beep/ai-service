import {
  describe, expect, it 
} from 'vitest';

import { resolvePagination } from '@persistence/repositories/Helpers.js';

describe('resolvePagination',
  () => {
    it('defaults to page 1 / perPage 50 for direct repository calls',
      () => {
        expect(resolvePagination()).toEqual({
          page: 1,
          perPage: 50,
          skip: 0,
          limit: 50 
        });
      });

    it('clamps page and perPage to at least 1',
      () => {
        expect(resolvePagination({
          page: 0,
          perPage: 0 
        })).toEqual({
          page: 1,
          perPage: 1,
          skip: 0,
          limit: 1,
        });
      });

    it('clamps perPage to the 100 cap',
      () => {
        expect(resolvePagination({
          page: 2,
          perPage: 1_000_000 
        })).toEqual({
          page: 2,
          perPage: 100,
          skip: 100,
          limit: 100,
        });
      });

    it('computes skip from the provided page and perPage',
      () => {
        expect(resolvePagination({
          page: 3,
          perPage: 25 
        })).toEqual({
          page: 3,
          perPage: 25,
          skip: 50,
          limit: 25,
        });
      });
  });
