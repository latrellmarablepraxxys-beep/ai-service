import {
  describe, expect, it 
} from 'vitest';

import {ROUTE_CLASSIFIER_SYSTEM_PROMPT, buildRouteClassifierMessages} from '@prompts/RouteClassifier.js';

describe('ROUTE_CLASSIFIER_SYSTEM_PROMPT',
  () => {
    it('defines all three routes',
      () => {
        expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain('"ai"');
        expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain('"agent"');
        expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain('"queue"');
      });

    it('lists every escalation topic',
      () => {
        const topics = [
          'Downpayment',
          'Credit card',
          'Monthly payment',
          'GCash',
          'GGives',
          '711',
          'Bayad sa Online',
          'Discounts',
          'OR/CR',
          'ORCR',
          'Certificate of Registration',
          'Official Receipt',
          'Rehistro',
          'Plate',
          'Accident',
        ];

        for (const topic of topics) {
          expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain(topic);
        }
      });

    it('specifies the JSON output shape',
      () => {
        expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain('"route"');
        expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain('"confidence"');
        expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain('"reasoning"');
        expect(ROUTE_CLASSIFIER_SYSTEM_PROMPT).toContain('JSON');
      });
  });

describe('buildRouteClassifierMessages',
  () => {
    it('puts the system prompt first and the text last',
      () => {
        const messages = buildRouteClassifierMessages({ text: 'Hello' });

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({
          role: 'system',
          content: ROUTE_CLASSIFIER_SYSTEM_PROMPT,
        });
        expect(messages[1]).toEqual({
          role: 'user',
          content: 'Hello' 
        });
      });

    it('wraps the context when provided',
      () => {
        const messages = buildRouteClassifierMessages({
          text: 'Magkano?',
          context: 'Customer is in Laguna',
        });

        const content = messages[1]?.content ?? '';
        expect(content).toContain('<context>\nCustomer is in Laguna\n</context>');
        expect(content).toContain('Magkano?');
      });
  });
