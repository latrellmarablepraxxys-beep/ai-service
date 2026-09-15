import {
  describe, expect, it, vi 
} from 'vitest';
import { Errors } from 'typesense';

import {
  createTypesenseClient,
  createTypesenseSearchClient,
} from '@services/typesense/TypesenseSearchClient.js';
import type { TypesenseClientLike } from '@interfaces/typesenseClient.js';

const httpError = (status: number, message: string): Error =>
  Object.assign(new Error(message), { httpStatus: status });

const createFakeTypesense = () => {
  const upsert = vi.fn().mockResolvedValue({});
  const importDocuments = vi.fn().mockResolvedValue({});
  const search = vi.fn();
  const create = vi.fn().mockResolvedValue({});
  const deleteDocument = vi.fn().mockResolvedValue({});
  const healthRetrieve = vi.fn().mockResolvedValue({ ok: true });
  const collectionNames: string[] = [];

  const collections = vi.fn((name?: string) => {
    if (name !== undefined) {
      collectionNames.push(name);
      return {
        documents: (id?: string) =>
          id !== undefined
            ? { delete: deleteDocument }
            : {
              upsert,
              search,
              import: importDocuments 
            },
      };
    }
    return { create };
  });

  return {
    collections,
    collectionNames,
    create,
    deleteDocument,
    health: { retrieve: healthRetrieve },
    healthRetrieve,
    importDocuments,
    upsert,
    search,
  };
};

const clientLike = (fake: ReturnType<typeof createFakeTypesense>): TypesenseClientLike =>
  fake as unknown as TypesenseClientLike;

describe('typesenseSearchClient',
  () => {
    it('prefixes collection names',
      async () => {
        const fake = createFakeTypesense();
        fake.search.mockResolvedValue({
          found: 0,
          page: 1,
          per_page: 10 
        });
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await searchClient.search('products',
          {
            q: 'x',
            queryBy: ['title'] 
          });

        expect(fake.collectionNames).toContain('test_products');
      });

    it('defaults the collection prefix from config',
      async () => {
        const fake = createFakeTypesense();
        const searchClient = createTypesenseSearchClient({ client: clientLike(fake) });

        await searchClient.upsertDocument<{ title: string }>('products',
          {
            id: '1',
            title: 'a' 
          });

        expect(fake.collectionNames).toContain('ai_products');
      });

    it('upserts a single document with the upsert action',
      async () => {
        const fake = createFakeTypesense();
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await searchClient.upsertDocument<{ title: string }>('products',
          {
            id: '1',
            title: 'a' 
          });

        expect(fake.upsert).toHaveBeenCalledWith({
          id: '1',
          title: 'a'
        }, { action: 'upsert' });
      });

    it('bulk-upserts multiple documents in a single import call',
      async () => {
        const fake = createFakeTypesense();
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await searchClient.upsertDocuments<{ title: string }>('products',
          [
            {
              id: '1',
              title: 'a' 
            },
            {
              id: '2',
              title: 'b' 
            },
          ]);

        expect(fake.importDocuments).toHaveBeenCalledTimes(1);
        expect(fake.importDocuments).toHaveBeenCalledWith(
          [
            {
              id: '1',
              title: 'a' 
            },
            {
              id: '2',
              title: 'b' 
            },
          ],
          { action: 'upsert' },
        );
        expect(fake.upsert).not.toHaveBeenCalled();
      });

    it('deletes a document by id',
      async () => {
        const fake = createFakeTypesense();
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await searchClient.deleteDocument('products', '7');

        expect(fake.deleteDocument).toHaveBeenCalledTimes(1);
      });

    it('maps search hits and found into a SearchResult',
      async () => {
        const fake = createFakeTypesense();
        fake.search.mockResolvedValue({
          found: 2,
          page: 1,
          per_page: 10,
          hits: [
            {
              document: {
                id: '1',
                title: 'a' 
              } 
            },
            {
              document: {
                id: '2',
                title: 'b' 
              } 
            }
          ],
        });
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        const result = await searchClient.search<{ title: string }>('products',
          {
            q: 'a',
            queryBy: ['title'],
            page: 1,
            perPage: 10,
          });

        expect(result.found).toBe(2);
        expect(result.items).toEqual([
          {
            id: '1',
            title: 'a' 
          },
          {
            id: '2',
            title: 'b' 
          },
        ]);
        expect(result.page).toBe(1);
        expect(result.perPage).toBe(10);
        expect(result.facetCounts).toBeUndefined();
      });

    it('maps facet_counts into facetCounts when present',
      async () => {
        const fake = createFakeTypesense();
        const facetCounts = [
          {
            field_name: 'brand',
            counts: [
              {
                count: 2,
                highlighted: 'acme',
                value: 'acme' 
              }
            ] 
          },
        ];
        fake.search.mockResolvedValue({
          found: 1,
          page: 1,
          per_page: 10,
          facet_counts: facetCounts 
        });
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        const result = await searchClient.search<{ title: string }>('products',
          {
            q: 'a',
            queryBy: ['title'],
          });

        expect(result.facetCounts).toEqual(facetCounts);
      });

    it('maps search query fields to Typesense snake_case params',
      async () => {
        const fake = createFakeTypesense();
        fake.search.mockResolvedValue({
          found: 0,
          page: 1,
          per_page: 10 
        });
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await searchClient.search('products',
          {
            q: 'car',
            queryBy: [
              'title',
              'description'
            ],
            filterBy: 'price:>10',
            sortBy: 'price:desc',
            maxHits: 50,
          });

        expect(fake.search).toHaveBeenCalledWith({
          q: 'car',
          query_by: [
            'title',
            'description'
          ],
          filter_by: 'price:>10',
          sort_by: 'price:desc',
          limit_hits: 50,
        });
      });

    it('creates a collection schema with the prefixed name',
      async () => {
        const fake = createFakeTypesense();
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await searchClient.ensureCollection('products',
          {
            name: 'products',
            fields: [
              {
                name: 'title',
                type: 'string' 
              }
            ],
            defaultSortingField: 'created_at',
          });

        expect(fake.create).toHaveBeenCalledWith({
          name: 'test_products',
          fields: [
            {
              name: 'title',
              type: 'string' 
            }
          ],
          default_sorting_field: 'created_at',
        });
      });

    it('treats an already-existing collection (SDK error) as success',
      async () => {
        const fake = createFakeTypesense();
        fake.create.mockRejectedValue(new Errors.ObjectAlreadyExists('Collection already exists'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(
          searchClient.ensureCollection('products',
            {
              name: 'products',
              fields: [] 
            }),
        ).resolves.toBeUndefined();
      });

    it('treats an HTTP 409 from a stub client as already-existing',
      async () => {
        const fake = createFakeTypesense();
        fake.create.mockRejectedValue(httpError(409, 'Resource already exists'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(
          searchClient.ensureCollection('products',
            {
              name: 'products',
              fields: [] 
            }),
        ).resolves.toBeUndefined();
      });

    it('maps non-already-exists collection failures to SEARCH_COLLECTION_ERROR',
      async () => {
        const fake = createFakeTypesense();
        fake.create.mockRejectedValue(httpError(503, 'collection unavailable'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(
          searchClient.ensureCollection('products',
            {
              name: 'products',
              fields: [] 
            }),
        ).rejects.toMatchObject({
          code: 'SEARCH_COLLECTION_ERROR',
          status: 503 
        });
      });

    it('maps 401 to SEARCH_UNAUTHORIZED',
      async () => {
        const fake = createFakeTypesense();
        fake.search.mockRejectedValue(httpError(401, 'unauthorized'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(
          searchClient.search('products',
            {
              q: 'a',
              queryBy: ['title'] 
            }),
        ).rejects.toMatchObject({
          code: 'SEARCH_UNAUTHORIZED',
          status: 401 
        });
      });

    it('maps 403 to SEARCH_UNAUTHORIZED with the actual status',
      async () => {
        const fake = createFakeTypesense();
        fake.search.mockRejectedValue(httpError(403, 'forbidden'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(
          searchClient.search('products',
            {
              q: 'a',
              queryBy: ['title'] 
            }),
        ).rejects.toMatchObject({
          code: 'SEARCH_UNAUTHORIZED',
          status: 403 
        });
      });

    it('maps 404 to SEARCH_NOT_FOUND',
      async () => {
        const fake = createFakeTypesense();
        fake.search.mockRejectedValue(httpError(404, 'not found'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(
          searchClient.search('products',
            {
              q: 'a',
              queryBy: ['title'] 
            }),
        ).rejects.toMatchObject({
          code: 'SEARCH_NOT_FOUND',
          status: 404 
        });
      });

    it('maps 429 to SEARCH_RATE_LIMITED',
      async () => {
        const fake = createFakeTypesense();
        fake.upsert.mockRejectedValue(httpError(429, 'too many requests'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(searchClient.upsertDocument('products', { id: '1' })).rejects.toMatchObject({
          code: 'SEARCH_RATE_LIMITED',
          status: 429,
        });
      });

    it('maps 503 to SEARCH_UNAVAILABLE',
      async () => {
        const fake = createFakeTypesense();
        fake.upsert.mockRejectedValue(httpError(503, 'service unavailable'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(searchClient.upsertDocument('products', { id: '1' })).rejects.toMatchObject({
          code: 'SEARCH_UNAVAILABLE',
          status: 503,
        });
      });

    it('maps bulk upsert failures through the same error mapping',
      async () => {
        const fake = createFakeTypesense();
        fake.importDocuments.mockRejectedValue(httpError(503, 'service unavailable'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(
          searchClient.upsertDocuments('products',
            [
              { id: '1' },
              { id: '2' }
            ]),
        ).rejects.toMatchObject({
          code: 'SEARCH_UNAVAILABLE',
          status: 503 
        });
      });

    it('maps timeouts to SEARCH_TIMEOUT',
      async () => {
        const fake = createFakeTypesense();
        fake.upsert.mockRejectedValue(new Error('request timed out'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(searchClient.upsertDocument('products', { id: '1' })).rejects.toMatchObject({
          code: 'SEARCH_TIMEOUT',
          status: 504,
        });
      });

    it('maps connection errors to SEARCH_UNAVAILABLE',
      async () => {
        const fake = createFakeTypesense();
        fake.upsert.mockRejectedValue(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(searchClient.upsertDocument('products', { id: '1' })).rejects.toMatchObject({
          code: 'SEARCH_UNAVAILABLE',
          status: 503,
        });
      });

    it('maps other failures to SEARCH_REQUEST_FAILED',
      async () => {
        const fake = createFakeTypesense();
        fake.upsert.mockRejectedValue(httpError(500, 'internal'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        await expect(searchClient.upsertDocument('products', { id: '1' })).rejects.toMatchObject({
          code: 'SEARCH_REQUEST_FAILED',
          status: 500,
        });
      });

    it('reports healthy with latency when the server is ok',
      async () => {
        const fake = createFakeTypesense();
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        const health = await searchClient.health();

        expect(health.connected).toBe(true);
        expect(health.latencyMs).toEqual(expect.any(Number));
      });

    it('reports unhealthy when the server responds not-ok',
      async () => {
        const fake = createFakeTypesense();
        fake.healthRetrieve.mockResolvedValue({ ok: false });
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        const health = await searchClient.health();

        expect(health).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });

    it('degrades gracefully when the health call throws',
      async () => {
        const fake = createFakeTypesense();
        fake.healthRetrieve.mockRejectedValue(new Error('refused'));
        const searchClient = createTypesenseSearchClient({
          client: clientLike(fake),
          collectionPrefix: 'test_',
        });

        const health = await searchClient.health();

        expect(health).toEqual({
          connected: false,
          latencyMs: undefined 
        });
      });
  });

describe('createTypesenseClient',
  () => {
  // Regression: the SDK mutates each node config (adds `path`), so the factory
  // must hand it mutable copies of the frozen config objects.
    it('builds a client from the frozen config without throwing',
      () => {
        const client = createTypesenseClient();

        expect(client).toBeDefined();
        expect(typeof client.health.retrieve).toBe('function');
      });
  });
