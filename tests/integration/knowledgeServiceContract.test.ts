import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@config/mockAdminApi.js',
  () => ({
    mockAdminApiConfig: {
      port: 0,
      apiKey: 'test-contract-key',
    },
  }));

import { FakeCacheClient } from '@fakes/fakeCacheClient.js';
import { createDomainHttpClient } from '@services/domain/DomainHttpClient.js';
import { createKnowledgeService } from '@services/knowledge/KnowledgeService.js';
import type { KnowledgeService } from '@interfaces/knowledge.js';
import { createMockAdminApp } from '@src/mock/MockAdminApp.js';

let server: Server;
let service: KnowledgeService;

const listen = (app: ReturnType<typeof createMockAdminApp>): Promise<number> =>
  new Promise((resolve) => {
    server = app.listen(0, () => {
      resolve((server.address() as AddressInfo).port);
    });
  });

const close = (): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

beforeAll(async () => {
  const port = await listen(createMockAdminApp());
  service = createKnowledgeService({
    client: createDomainHttpClient({
      baseUrl: `http://127.0.0.1:${port}/api/v1`,
      apiKey: 'test-contract-key',
      timeoutMs: 5_000,
    }),
    cache: new FakeCacheClient(),
    ttlSeconds: 60,
  });
});

afterAll(async () => {
  await close();
});

describe('knowledge service ↔ mock admin contract',
  () => {
    it('lists the escalation topics',
      async () => {
        const topics = await service.getEscalationTopics();

        expect(topics).toHaveLength(12);
        expect(topics.find((topic) => topic.key === 'ORCR')).toMatchObject({
          label: 'OR/CR',
          department: 'REGISTRATION',
          priority: 'HIGH',
          fallbackTemplateKey: 'fallback.escalation',
        });
      });

    it('fetches the greeting template with content and version',
      async () => {
        const entry = await service.getTemplate('greeting.initial');

        expect(entry?.key).toBe('greeting.initial');
        expect(entry?.version).toBe(1);
        expect(entry?.content).toContain('{{branch_page}}');
      });

    it('finds the Click product with exact STD terms',
      async () => {
        const products = await service.findProducts('click');
        const product = products.find((entry) => entry.name === 'Honda Click 125');

        expect(product?.variants).toHaveLength(2);
        const std = product?.variants.find((variant) => variant.variantName === 'V4 STD');
        expect(std?.minDownpayment).toBe(6_700);
        expect(std?.terms.map((term) => term.monthlyAmount)).toEqual([
          9_105,
          5_395,
          4_250
        ]);
        const se = product?.variants.find((variant) => variant.variantName === 'V4 SE');
        expect(se?.terms).toEqual([]);
      });

    it('fetches the 10-item installment freebies package',
      async () => {
        const promotion = await service.getFreebies('installment');

        expect(promotion?.items).toHaveLength(10);
        expect(promotion?.items.map((item) => item.sortOrder)).toEqual([
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ]);
        expect(promotion?.items[0]?.body).toBe('✅ Free Motorcentral Half Face Helmet.');
      });
  });
