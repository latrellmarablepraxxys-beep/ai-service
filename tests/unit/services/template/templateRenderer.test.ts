import {
  describe, expect, it 
} from 'vitest';

import {
  formatPeso,
  renderCashBlock,
  renderFreebiesList,
  renderInstallmentBlock,
  renderTemplate,
  spliceTemplate,
} from '@services/template/TemplateRenderer.js';
import { AppError } from '@utils/errors.js';

describe('formatPeso',
  () => {
    it('formats with the peso sign and en-PH grouping without decimals',
      () => {
        expect(formatPeso(6700)).toBe('₱6,700');
        expect(formatPeso(84850)).toBe('₱84,850');
        expect(formatPeso(200)).toBe('₱200');
      });

    it.each([
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])('rejects %s',
      (amount) => {
        expect(() => formatPeso(amount)).toThrowError(AppError);
      });
  });

describe('renderInstallmentBlock',
  () => {
    it('matches playbook section 5.2 exactly',
      () => {
        expect(
          renderInstallmentBlock({
            productName: 'Honda',
            variantName: 'CLICK 125 V4 STD',
            minDownpayment: 6700,
            terms: [
              {
                termMonths: 12,
                monthlyAmount: 9105 
              },
              {
                termMonths: 24,
                monthlyAmount: 5395 
              },
              {
                termMonths: 36,
                monthlyAmount: 4250 
              },
            ],
            updatedPaymentLess: 200,
          }),
        ).toBe(
          [
            '🏍 Honda CLICK 125 V4 STD',
            '💵 Minimum Downpayment: ₱6,700',
            '📅 Installment Terms:',
            '✅ 1 Year: ₱9,105 per month',
            '✅ 2 Years: ₱5,395 per month',
            '✅ 3 Years: ₱4,250 per month',
            '🎁 Less ₱200 monthly for updated payment.',
            'Gusto niyo po bang malaman ang mga kasamang freebies?',
          ].join('\n'),
        );
      });

    it('sorts terms ascending and renders only the terms provided',
      () => {
        const rendered = renderInstallmentBlock({
          productName: 'Honda',
          variantName: 'CLICK 125 V4 STD',
          minDownpayment: 6700,
          terms: [
            {
              termMonths: 36,
              monthlyAmount: 4250 
            },
            {
              termMonths: 12,
              monthlyAmount: 9105 
            },
          ],
          updatedPaymentLess: null,
        });

        expect(rendered).toContain('✅ 1 Year: ₱9,105 per month\n✅ 3 Years: ₱4,250 per month');
        expect(rendered).not.toContain('🎁');
      });

    it('honours a custom freebies question',
      () => {
        const rendered = renderInstallmentBlock({
          productName: 'Honda',
          variantName: 'CLICK 125 V4 STD',
          minDownpayment: 6700,
          terms: [
            {
              termMonths: 12,
              monthlyAmount: 9105 
            },
          ],
          updatedPaymentLess: null,
          freebiesQuestion: 'Gusto niyo po ng helmet?',
        });

        expect(rendered.endsWith('Gusto niyo po ng helmet?')).toBe(true);
      });

    it('rejects empty terms',
      () => {
        expect(() =>
          renderInstallmentBlock({
            productName: 'Honda',
            variantName: 'CLICK 125 V4 STD',
            minDownpayment: 6700,
            terms: [],
            updatedPaymentLess: null,
          }),
        ).toThrowError(AppError);
      });
  });

describe('renderCashBlock',
  () => {
    it('matches playbook section 5.3 exactly',
      () => {
        expect(
          renderCashBlock({
            productName: 'Honda',
            variantName: 'CLICK 125 V4 STD',
            cashPrice: 84850,
          }),
        ).toBe(
          [
            '🏍 Honda CLICK 125 V4 STD',
            '💰 Cash Price: ₱84,850',
            'Gusto niyo po bang malaman ang mga kasamang freebies?',
          ].join('\n'),
        );
      });
  });

describe('renderFreebiesList',
  () => {
    it('joins items with newlines',
      () => {
        expect(renderFreebiesList([
          '✅ Helmet',
          '✅ LTO'
        ])).toBe('✅ Helmet\n✅ LTO');
      });

    it('rejects an empty list',
      () => {
        expect(() => renderFreebiesList([])).toThrowError(AppError);
      });
  });

describe('renderTemplate',
  () => {
    it('substitutes known tokens verbatim',
      () => {
        expect(renderTemplate('Hi {{name}}, {{greeting}}!', {
          name: 'Juan',
          greeting: 'kumusta' 
        })).toBe('Hi Juan, kumusta!');
      });

    it('throws listing the missing token names and keeps known substitutions out of the error',
      () => {
        try {
          renderTemplate('Hi {{name}}, see {{link}}', { name: 'Juan' });
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          expect((error as AppError).code).toBe('TEMPLATE_RENDER_ERROR');
          expect((error as Error).message).toContain('link');
          return;
        }
        throw new Error('Expected renderTemplate to throw');
      });
  });

describe('spliceTemplate',
  () => {
    it('replaces the first marker occurrence',
      () => {
        expect(spliceTemplate('A {{template}} B {{template}}', 'X')).toBe('A X B {{template}}');
      });

    it('appends the block when the marker is absent',
      () => {
        expect(spliceTemplate('Hello', 'World')).toBe('Hello\n\nWorld');
      });
  });
