import {
  describe, expect, it 
} from 'vitest';

import { FakeKnowledgeService } from './fakeKnowledgeService.js';

describe('FakeKnowledgeService',
  () => {
    it('returns the canned greeting template',
      async () => {
        const fake = new FakeKnowledgeService();

        const template = await fake.getTemplate('greeting.initial');

        expect(template).toMatchObject({
          key: 'greeting.initial',
          version: 1,
        });
      });

    it('returns null for an unknown template key',
      async () => {
        const fake = new FakeKnowledgeService();

        await expect(fake.getTemplate('missing.key')).resolves.toBeNull();
      });

    it('filters entries by the requested keys',
      async () => {
        const fake = new FakeKnowledgeService();

        await expect(fake.getEntries(['greeting.initial'])).resolves.toHaveLength(1);
        await expect(fake.getEntries(['missing.key'])).resolves.toEqual([]);
      });

    it('returns the canned ORCR and MONTHLY_PAYMENT topics',
      async () => {
        const fake = new FakeKnowledgeService();

        const topics = await fake.getEscalationTopics();

        expect(topics.map((topic) => topic.key)).toEqual([
          'ORCR',
          'MONTHLY_PAYMENT'
        ]);
      });

    it('finds the Honda Click 125 by a case-insensitive query',
      async () => {
        const fake = new FakeKnowledgeService();

        const products = await fake.findProducts('  CLICK ');

        expect(products).toHaveLength(1);
        expect(products[0]).toMatchObject({
          name: 'Honda Click 125',
          brand: 'Honda',
        });
        expect(products[0]?.variants).toHaveLength(2);
      });

    it('returns no products when nothing matches',
      async () => {
        const fake = new FakeKnowledgeService();

        await expect(fake.findProducts('yamaha nmax')).resolves.toEqual([]);
      });

    it('exposes the priced STD variant and the unpriced SE variant',
      async () => {
        const fake = new FakeKnowledgeService();

        const [product] = await fake.findProducts('click');
        const [
          std,
          se
        ] = product?.variants ?? [];

        expect(std).toMatchObject({
          variantName: 'V4 STD',
          cashPrice: 84850,
          minDownpayment: 6700,
          updatedPaymentLess: 200,
        });
        expect(std?.terms).toEqual([
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
        expect(se).toMatchObject({
          variantName: 'V4 SE',
          cashPrice: null,
          minDownpayment: null,
          updatedPaymentLess: null,
        });
        expect(se?.terms).toEqual([]);
      });

    it('returns the installment promotion with at least two items',
      async () => {
        const fake = new FakeKnowledgeService();

        const promotion = await fake.getFreebies('installment');

        expect(promotion?.applicability).toBe('installment');
        expect(promotion?.items.length).toBeGreaterThanOrEqual(2);
      });

    it('returns null when no promotion matches',
      async () => {
        const fake = new FakeKnowledgeService({ promotions: [] });

        await expect(fake.getFreebies('cash')).resolves.toBeNull();
      });

    it('honours per-concern overrides',
      async () => {
        const fake = new FakeKnowledgeService({
          templates: [],
          topics: [],
          products: [],
          promotions: [],
        });

        await expect(fake.getTemplate('greeting.initial')).resolves.toBeNull();
        await expect(fake.getEntries(['greeting.initial'])).resolves.toEqual([]);
        await expect(fake.getEscalationTopics()).resolves.toEqual([]);
        await expect(fake.findProducts('click')).resolves.toEqual([]);
        await expect(fake.getFreebies('installment')).resolves.toBeNull();
      });
  });
