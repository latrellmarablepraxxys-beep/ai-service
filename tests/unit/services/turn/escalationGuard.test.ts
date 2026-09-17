import {
  describe, expect, it 
} from 'vitest';

import type { EscalationTopic } from '@interfaces/knowledge.js';
import { matchEscalationTopic } from '@services/turn/EscalationGuard.js';

const topic = (
  key: string,
  keywords: string[],
  department = 'FINANCE',
): EscalationTopic => ({
  key,
  label: key,
  keywords,
  department,
  priority: 'MEDIUM',
  fallbackTemplateKey: 'fallback.escalation',
});

const TOPICS: EscalationTopic[] = [
  topic('ORCR', [
    'orcr',
    'or/cr',
    'or cr',
    'rehistro'
  ], 'REGISTRATION'),
  topic('MONTHLY_PAYMENT', [
    'monthly payment',
    'monthly',
    'magkano monthly'
  ]),
  topic('PLATE', [
    'plate',
    'plaka'
  ], 'REGISTRATION'),
  topic('DOCUMENTS', [
    'documents',
    'orcr plate'
  ], 'REGISTRATION'),
  topic('GCASH_PAYMENT', [
    'gcash',
    'gcash payment'
  ]),
  topic('PAYMENT_711', [
    '711',
    '7-11',
    'seven eleven'
  ]),
  topic('GGIVES', [
    'ggives',
    'gives'
  ]),
  topic('DISCOUNT', ['less']),
];

const matchKey = (text: string): string | null =>
  matchEscalationTopic(text, TOPICS)?.key ?? null;

describe('matchEscalationTopic',
  () => {
    it('matches across case and punctuation variants',
      () => {
        expect(matchKey('Nasaan na ang OR/CR ko?')).toBe('ORCR');
        expect(matchKey('orcr')).toBe('ORCR');
        expect(matchKey('OR CR')).toBe('ORCR');
        expect(matchKey('rehistro ng motor')).toBe('ORCR');
      });

    it('matches case-insensitively in Tagalog text',
      () => {
        expect(matchKey('magkano monthly ko?')).toBe('MONTHLY_PAYMENT');
        expect(matchKey('PLAKA')).toBe('PLATE');
      });

    it('returns null when nothing matches',
      () => {
        expect(matchKey('Kamusta po?')).toBeNull();
        expect(matchKey('')).toBeNull();
        expect(matchKey('Magkano po ang Click 125?')).toBeNull();
      });

    it('prefers the longest matching keyword across topics',
      () => {
        expect(matchKey('my orcr plate papers')).toBe('DOCUMENTS');
      });

    it('breaks keyword-length ties by array order',
      () => {
        const tied: EscalationTopic[] = [
          topic('FIRST', ['hulugan']),
          topic('SECOND', ['hulugan']),
        ];

        expect(matchEscalationTopic('hulugan', tied)?.key).toBe('FIRST');
      });

    it('matches payment keywords across separator variants',
      () => {
        expect(matchKey('gcash')).toBe('GCASH_PAYMENT');
        expect(matchKey('7-11')).toBe('PAYMENT_711');
      });

    it.each([
      'template',
      'priceless',
      'forgives',
      'monthlyxxx',
    ])('does not match a keyword buried inside %s',
      (text) => {
        expect(matchKey(text)).toBeNull();
      });
  });
