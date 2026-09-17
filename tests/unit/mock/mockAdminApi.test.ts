import request from 'supertest';
import {
  describe, expect, it, vi 
} from 'vitest';

import type {
  MockAiResponseTemplateResource,
  MockBranchResource,
  MockErrorResponse,
  MockMotorcycleResource,
  MockSuccessResponse,
} from '@interfaces/mockAdminApi.js';

vi.mock('@config/mockAdminApi.js',
  () => ({
    mockAdminApiConfig: {
      port: 0,
      apiKey: 'test-mock-key' 
    },
  }));

import { createMockAdminApp } from '@src/mock/MockAdminApp.js';

const KEY = 'test-mock-key';
const app = () => createMockAdminApp();

describe('mock admin API — auth',
  () => {
    it('rejects a request without an API key',
      async () => {
        const response = await request(app()).get('/api/v1/motorcycles');

        expect(response.status).toBe(401);
        expect((response.body as MockErrorResponse).error)
          .toBe('Unauthorized or invalid key detected. Failed to access content.');
      });

    it('rejects a wrong API key',
      async () => {
        const response = await request(app()).get('/api/v1/motorcycles').set('X-Api-Key', 'nope');

        expect(response.status).toBe(401);
      });

    it('accepts the key from the X-Api-Key header',
      async () => {
        const response = await request(app()).get('/api/v1/motorcycles').set('X-Api-Key', KEY);

        expect(response.status).toBe(200);
      });

    it('accepts the key from the api_key query param',
      async () => {
        const response = await request(app()).get(`/api/v1/motorcycles?api_key=${KEY}`);

        expect(response.status).toBe(200);
      });

    it('returns an admin-shaped 404 for an unknown route',
      async () => {
        const response = await request(app()).get('/api/v1/nope').set('X-Api-Key', KEY);

        expect(response.status).toBe(404);
        expect(response.body as MockErrorResponse).toEqual({
          error: 'Resource Not Found',
          status: 404,
        });
      });
  });

describe('mock admin API — GET /api/v1/health',
  () => {
    it('rejects a missing platform header with a Laravel-shaped 422',
      async () => {
        const response = await request(app()).get('/api/v1/health').set('X-Api-Key', KEY);

        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          message: 'Invalid platform provided.',
          errors: { error: ['Invalid platform provided.'] },
        });
      });

    it('rejects an invalid platform header',
      async () => {
        const response = await request(app())
          .get('/api/v1/health')
          .set('X-Api-Key', KEY)
          .set('X-Platform-Access', 'desktop');

        expect(response.status).toBe(422);
      });

    it('returns the health payload for a valid platform',
      async () => {
        const response = await request(app())
          .get('/api/v1/health')
          .set('X-Api-Key', KEY)
          .set('X-Platform-Access', 'web');

        expect(response.status).toBe(200);
        const body = response.body as MockSuccessResponse<{ status: string; database: string }>;
        expect(body.success).toBe(true);
        expect(body.message).toBe('Service is healthy.');
        expect(body.data.status).toBe('ok');
        expect(body.data.database).toBe('ok');
      });
  });

describe('mock admin API — GET /api/v1/motorcycles',
  () => {
    it('returns the seeded list with the admin envelope and meta',
      async () => {
        const response = await request(app()).get('/api/v1/motorcycles').set('X-Api-Key', KEY);

        expect(response.status).toBe(200);
        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.success).toBe(true);
        expect(body.message).toBe('Motorcycles retrieved.');
        expect(body.meta).toEqual({
          current_page: 1,
          per_page: 15,
          total: 10,
          last_page: 1,
        });
        expect(body.data[0]?.name).toBe('Honda ADV160');
        expect(body.data.find((motorcycle) => motorcycle.id === 1)).toMatchObject({
          id: 1,
          name: 'Honda Click 125i',
          code: 'H-CLICK125I',
          brand: 'HONDA',
          variant_type: 'STD',
          srp: 82_000,
          status: 0,
          status_label: 'Available',
          is_available: true,
          image_url: null,
        });
      });

    it('filters by brand[]',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?brand[]=HONDA')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.meta?.total).toBe(5);
        expect(body.data.every((motorcycle) => motorcycle.brand === 'HONDA')).toBe(true);
      });

    it('filters by status[]',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?status[]=1')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.meta?.total).toBe(1);
        expect(body.data[0]?.name).toBe('Kawasaki Rouser NS160');
        expect(body.data[0]?.status_label).toBe('Discontinued');
      });

    it('filters by search on name/code',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?search=click')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.meta?.total).toBe(2);
      });

    it('filters by available=true',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?available=true')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.meta?.total).toBe(8);
        expect(body.data.every((motorcycle) => motorcycle.is_available)).toBe(true);
      });

    it('filters by srp range',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?min_srp=100000')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.meta?.total).toBe(6);
      });

    it('sorts by srp_desc',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?sort=srp_desc')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.data[0]?.name).toBe('Honda CB500X');
      });

    it('paginates and reports meta',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?per_page=3&page=2')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockMotorcycleResource[]>;
        expect(body.data).toHaveLength(3);
        expect(body.meta).toEqual({
          current_page: 2,
          per_page: 3,
          total: 10,
          last_page: 4,
        });
      });

    it('rejects per_page above the max with a Laravel-shaped 422',
      async () => {
        const response = await request(app())
          .get('/api/v1/motorcycles?per_page=100')
          .set('X-Api-Key', KEY);

        expect(response.status).toBe(422);
        expect(response.body).toHaveProperty('errors.per_page');
      });
  });

describe('mock admin API — GET /api/v1/branches',
  () => {
    it('returns the seeded list',
      async () => {
        const response = await request(app()).get('/api/v1/branches').set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockBranchResource[]>;
        expect(response.status).toBe(200);
        expect(body.message).toBe('Branches retrieved.');
        expect(body.meta?.total).toBe(6);
        expect(body.data[0]?.name).toBe('BGC Showroom');
        expect(body.data.find((branch) => branch.code === 'HQ')).toMatchObject({
          id: 1,
          code: 'HQ',
          name: 'Head Office',
          address: 'National Headquarters',
          status: 1,
          status_label: 'Active',
          enable_ai_assist: true,
          page_name: null,
        });
      });

    it('filters by status[] and enable_ai_assist',
      async () => {
        const response = await request(app())
          .get('/api/v1/branches?status[]=0&enable_ai_assist=false')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockBranchResource[]>;
        expect(body.meta?.total).toBe(1);
        expect(body.data[0]?.code).toBe('QC');
      });

    it('searches name/address/code',
      async () => {
        const response = await request(app())
          .get('/api/v1/branches?search=cebu')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockBranchResource[]>;
        expect(body.meta?.total).toBe(1);
        expect(body.data[0]?.code).toBe('CEB');
      });
  });

describe('mock admin API — GET /api/v1/ai-response-templates',
  () => {
    it('returns the seeded templates ordered by id',
      async () => {
        const response = await request(app())
          .get('/api/v1/ai-response-templates')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockAiResponseTemplateResource[]>;
        expect(response.status).toBe(200);
        expect(body.message).toBe('AI response templates retrieved.');
        expect(body.meta?.total).toBe(6);
        expect(body.data.map((template) => template.id)).toEqual([
          1,
          2,
          3,
          4,
          5,
          6
        ]);
        expect(body.data[0]).toMatchObject({
          title: 'Welcome Message',
          type: 1,
          type_label: 'Greeting',
        });
      });

    it('filters by type[]',
      async () => {
        const response = await request(app())
          .get('/api/v1/ai-response-templates?type[]=2')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockAiResponseTemplateResource[]>;
        expect(body.meta?.total).toBe(4);
        expect(body.data.every((template) => template.type_label === 'Templated')).toBe(true);
      });

    it('searches title/content',
      async () => {
        const response = await request(app())
          .get('/api/v1/ai-response-templates?search=Welcome')
          .set('X-Api-Key', KEY);

        const body = response.body as MockSuccessResponse<MockAiResponseTemplateResource[]>;
        expect(body.meta?.total).toBe(2);
      });
  });
