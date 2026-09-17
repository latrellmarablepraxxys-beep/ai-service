import {
  describe, expect, it 
} from 'vitest';

import { KnowledgeContentType } from '@enums/KnowledgeContentType.js';
import { FakeCacheClient } from '@fakes/fakeCacheClient.js';
import type { CacheClient } from '@interfaces/cache.js';
import type {
  DomainHttpClient,
  DomainHttpQueryValue,
} from '@interfaces/domain.js';
import { DEGRADED_ESCALATION_TOPICS } from '@services/knowledge/DegradedEscalationSeed.js';
import { createKnowledgeService } from '@services/knowledge/KnowledgeService.js';
import { AppError } from '@utils/errors.js';

type Query = Record<string, DomainHttpQueryValue>;

const entriesEnvelope = {
  success: true,
  data: [
    {
      id: 1,
      key: 'greeting.initial',
      title: 'Initial greeting',
      content: 'Kamusta po!',
      content_type: 1,
      version: 1,
      is_current: true,
    }
  ],
};

const topicsEnvelope = {
  success: true,
  data: [
    {
      id: 1,
      key: 'ORCR',
      label: 'OR/CR',
      keywords: [
        'orcr',
        'or/cr'
      ],
      department: 'REGISTRATION',
      priority: 'HIGH',
      fallback_template_key: 'fallback.escalation',
      is_active: true,
    }
  ],
};

const motorcyclesEnvelope = {
  success: true,
  data: [
    {
      id: 1,
      name: 'Honda Click 125',
      code: 'CLICK125',
      brand: 'Honda',
      variant_type: 'scooter',
      srp: 84850,
      status: 1,
      status_label: 'Available',
      is_available: true,
      description: 'A scooter.',
      image_url: null,
      variants: [
        {
          id: 10,
          motorcycle_id: 1,
          name: 'V4 STD',
          code: 'CLICK125-STD',
          image_url: null,
          cash_price: 84850,
          min_downpayment: 6700,
          updated_payment_less: 200,
          terms: [
            {
              term_months: 36,
              monthly_amount: 4250,
            },
            {
              term_months: 12,
              monthly_amount: 9105,
            },
            {
              term_months: 24,
              monthly_amount: 5395,
            }
          ],
        }
      ],
    }
  ],
};

const promotionsEnvelope = {
  success: true,
  data: [
    {
      id: 5,
      name: 'Installment Freebies',
      applicability: 'installment',
      items: [
        {
          body: 'Second item.',
          sort_order: 2,
        },
        {
          body: 'First item.',
          sort_order: 1,
        }
      ],
      is_current: true,
    }
  ],
};

const defaultEnvelopes: Record<string, unknown> = {
  '/knowledge-entries': entriesEnvelope,
  '/escalation-topics': topicsEnvelope,
  '/motorcycles': motorcyclesEnvelope,
  '/promotions': promotionsEnvelope,
};

const createStubClient = (overrides: Record<string, unknown> = {}) => {
  let calls = 0;
  const seenQueries: Query[] = [];
  const client: DomainHttpClient = {
    get: (path, query) => {
      calls += 1;
      if (query !== undefined) seenQueries.push(query);
      if (path in overrides) {
        const response = overrides[path];
        if (response instanceof Error) return Promise.reject(response);
        return Promise.resolve(response);
      }
      return Promise.resolve(defaultEnvelopes[path]);
    },
  };
  return {
    client,
    callCount: () => calls,
    seenQueries,
  };
};

const createFailingCache = (failure: AppError = new AppError('CACHE_ERROR', 500, 'cache is down')): CacheClient => {
  const fail = (): Promise<never> => Promise.reject(failure);
  return {
    get<T>(_key: string): Promise<T | null> {
      return fail();
    },
    set<T>(_key: string, _value: T): Promise<void> {
      return fail();
    },
    withTtl<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {
      return fail();
    },
    del(_key: string): Promise<void> {
      return fail();
    },
    has(_key: string): Promise<boolean> {
      return fail();
    },
    health() {
      return Promise.resolve({
        connected: false,
        latencyMs: undefined,
      });
    },
  };
};

const createRecordingCache = () => {
  const store = new Map<string, unknown>();
  const writes: Array<{ key: string; ttlSeconds: number }> = [];
  const cache: CacheClient = {
    get<T>(key: string): Promise<T | null> {
      if (!store.has(key)) return Promise.resolve(null);
      return Promise.resolve(store.get(key) as T);
    },
    set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
      return Promise.resolve();
    },
    withTtl<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      writes.push({
        key,
        ttlSeconds,
      });
      store.set(key, value);
      return Promise.resolve();
    },
    del(key: string): Promise<void> {
      store.delete(key);
      return Promise.resolve();
    },
    has(key: string): Promise<boolean> {
      return Promise.resolve(store.has(key));
    },
    health() {
      return Promise.resolve({
        connected: true,
        latencyMs: 0,
      });
    },
  };
  return {
    cache,
    writes,
  };
};

describe('knowledgeService',
  () => {
    it('serves entries from cache without touching the client',
      async () => {
        const stub = createStubClient();
        const cache = new FakeCacheClient();
        await cache.withTtl('knowledge:entries:greeting.initial',
          [
            {
              key: 'greeting.initial',
              title: 'Cached',
              content: 'cached content',
              contentType: KnowledgeContentType.Template,
              variables: [],
              triggers: [],
              version: 1,
            }
          ],
          300);
        const service = createKnowledgeService({
          client: stub.client,
          cache,
          ttlSeconds: 300,
        });

        const entries = await service.getEntries(['greeting.initial']);

        expect(entries).toHaveLength(1);
        expect(entries[0]?.title).toBe('Cached');
        expect(stub.callCount()).toBe(0);
      });

    it('fetches entries on a miss, then serves the second call from cache',
      async () => {
        const stub = createStubClient();
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        const first = await service.getEntries(['greeting.initial']);
        const second = await service.getEntries(['greeting.initial']);

        expect(first).toEqual([
          {
            key: 'greeting.initial',
            title: 'Initial greeting',
            content: 'Kamusta po!',
            contentType: KnowledgeContentType.Template,
            variables: [],
            triggers: [],
            version: 1,
          }
        ]);
        expect(second).toEqual(first);
        expect(stub.callCount()).toBe(1);
      });

    it('shares one cache entry regardless of key order',
      async () => {
        const stub = createStubClient();
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        await service.getEntries([
          'b',
          'a'
        ]);
        await service.getEntries([
          'a',
          'b'
        ]);

        expect(stub.callCount()).toBe(1);
      });

    it('returns an empty array without calling the client when no keys are requested',
      async () => {
        const stub = createStubClient();
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        await expect(service.getEntries([])).resolves.toEqual([]);
        expect(stub.callCount()).toBe(0);
      });

    it('passes the configured TTL through to cache writes',
      async () => {
        const stub = createStubClient();
        const {
          cache, writes 
        } = createRecordingCache();
        const service = createKnowledgeService({
          client: stub.client,
          cache,
          ttlSeconds: 60,
        });

        await service.getEntries(['greeting.initial']);

        expect(writes).toEqual([
          {
            key: 'knowledge:entries:greeting.initial',
            ttlSeconds: 60,
          }
        ]);
      });

    it('resolves a template from its entries and caches it under the template key',
      async () => {
        const stub = createStubClient();
        const {
          cache, writes 
        } = createRecordingCache();
        const service = createKnowledgeService({
          client: stub.client,
          cache,
          ttlSeconds: 300,
        });

        const first = await service.getTemplate('greeting.initial');
        const second = await service.getTemplate('greeting.initial');

        expect(first?.key).toBe('greeting.initial');
        expect(second).toEqual(first);
        expect(stub.callCount()).toBe(1);
        expect(writes.map((write) => write.key)).toContain('knowledge:template:greeting.initial');
      });

    it('resolves an unknown template to null',
      async () => {
        const stub = createStubClient({
          '/knowledge-entries': {
            success: true,
            data: [] 
          } 
        });
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        await expect(service.getTemplate('missing.key')).resolves.toBeNull();
      });

    it('maps escalation topics and caches them',
      async () => {
        const stub = createStubClient();
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        const first = await service.getEscalationTopics();
        const second = await service.getEscalationTopics();

        expect(first).toEqual([
          {
            key: 'ORCR',
            label: 'OR/CR',
            keywords: [
              'orcr',
              'or/cr'
            ],
            department: 'REGISTRATION',
            priority: 'HIGH',
            fallbackTemplateKey: 'fallback.escalation',
          }
        ]);
        expect(second).toEqual(first);
        expect(stub.callCount()).toBe(1);
      });

    it('returns the degraded seed when the client fails on a cache miss',
      async () => {
        const stub = createStubClient({'/escalation-topics': new AppError('DOMAIN_TIMEOUT', 504, 'timed out'),});
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        const topics = await service.getEscalationTopics();

        expect(topics).toEqual(DEGRADED_ESCALATION_TOPICS);
        expect(topics).toHaveLength(12);
      });

    it('returns the degraded seed when both the cache and the client fail',
      async () => {
        const stub = createStubClient({'/escalation-topics': new AppError('DOMAIN_CONNECTION_ERROR', 503, 'unreachable'),});
        const service = createKnowledgeService({
          client: stub.client,
          cache: createFailingCache(),
          ttlSeconds: 300,
        });

        const topics = await service.getEscalationTopics();

        expect(topics).toEqual(DEGRADED_ESCALATION_TOPICS);
      });

    it('returns the degraded seed on a 5xx domain failure',
      async () => {
        const stub = createStubClient({'/escalation-topics': new AppError('DOMAIN_API_ERROR', 503, 'backend down'),});
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        const topics = await service.getEscalationTopics();

        expect(topics).toEqual(DEGRADED_ESCALATION_TOPICS);
      });

    it('rethrows auth failures instead of serving the degraded seed',
      async () => {
        const failure = new AppError('DOMAIN_AUTH_ERROR', 401, 'unauthorized');
        const stub = createStubClient({ '/escalation-topics': failure });
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        await expect(service.getEscalationTopics()).rejects.toMatchObject({ code: 'DOMAIN_AUTH_ERROR' });
      });

    it('rethrows malformed topic envelopes instead of serving the degraded seed',
      async () => {
        const stub = createStubClient({
          '/escalation-topics': {
            success: true,
            data: [{ bogus: 1 }] 
          } 
        });
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        await expect(service.getEscalationTopics()).rejects.toMatchObject({ code: 'DOMAIN_VALIDATION_ERROR' });
      });

    it('normalizes the search query, maps variants, and sorts terms ascending',
      async () => {
        const stub = createStubClient();
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        const products = await service.findProducts('  CLICK ');

        expect(stub.seenQueries).toEqual([
          {
            search: 'click',
            include: 'variants,terms',
            available: 1,
          }
        ]);
        expect(products).toHaveLength(1);
        expect(products[0]).toMatchObject({
          id: '1',
          name: 'Honda Click 125',
          brand: 'Honda',
        });
        expect(products[0]?.variants).toHaveLength(1);
        expect(products[0]?.variants[0]).toMatchObject({
          id: '10',
          productId: '1',
          productName: 'Honda Click 125',
          variantName: 'V4 STD',
          imageUrl: null,
          cashPrice: 84850,
          minDownpayment: 6700,
          updatedPaymentLess: 200,
        });
        expect(products[0]?.variants[0]?.terms).toEqual([
          {
            termMonths: 12,
            monthlyAmount: 9105,
          },
          {
            termMonths: 24,
            monthlyAmount: 5395,
          },
          {
            termMonths: 36,
            monthlyAmount: 4250,
          }
        ]);
      });

    it('picks the first promotion and sorts its items by sort order',
      async () => {
        const stub = createStubClient();
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        const promotion = await service.getFreebies('installment');

        expect(stub.seenQueries).toEqual([
          {
            applicability: 'installment',
            current: 1,
          }
        ]);
        expect(promotion).toEqual({
          id: '5',
          name: 'Installment Freebies',
          applicability: 'installment',
          items: [
            {
              body: 'First item.',
              sortOrder: 1,
            },
            {
              body: 'Second item.',
              sortOrder: 2,
            }
          ],
        });
      });

    it('resolves no promotion to null',
      async () => {
        const stub = createStubClient({
          '/promotions': {
            success: true,
            data: [] 
          } 
        });
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        await expect(service.getFreebies('cash')).resolves.toBeNull();
      });

    it('rejects malformed envelopes with an AppError, not the raw Zod error',
      async () => {
        const stub = createStubClient({
          '/knowledge-entries': {
            success: true,
            data: [{ bogus: 1 }] 
          } 
        });
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        const error = await service.getEntries(['greeting.initial']).then(
          () => { throw new Error('expected getEntries to reject'); },
          (cause: unknown) => cause,
        );

        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({ code: 'DOMAIN_VALIDATION_ERROR' });
      });

    it('lets client errors propagate for non-topic methods',
      async () => {
        const failure = new AppError('DOMAIN_TIMEOUT', 504, 'timed out');
        const stub = createStubClient({
          '/knowledge-entries': failure,
          '/motorcycles': failure,
          '/promotions': failure,
        });
        const service = createKnowledgeService({
          client: stub.client,
          cache: new FakeCacheClient(),
          ttlSeconds: 300,
        });

        await expect(service.getEntries(['greeting.initial'])).rejects.toMatchObject({ code: 'DOMAIN_TIMEOUT' });
        await expect(service.getTemplate('greeting.initial')).rejects.toMatchObject({ code: 'DOMAIN_TIMEOUT' });
        await expect(service.findProducts('click')).rejects.toMatchObject({ code: 'DOMAIN_TIMEOUT' });
        await expect(service.getFreebies('installment')).rejects.toMatchObject({ code: 'DOMAIN_TIMEOUT' });
      });

    it('lets cache errors propagate for non-topic methods',
      async () => {
        const stub = createStubClient();
        const service = createKnowledgeService({
          client: stub.client,
          cache: createFailingCache(new AppError('CACHE_ERROR', 500, 'cache is down')),
          ttlSeconds: 300,
        });

        await expect(service.getEntries(['greeting.initial'])).rejects.toMatchObject({ code: 'CACHE_ERROR' });
        expect(stub.callCount()).toBe(0);
      });
  });
