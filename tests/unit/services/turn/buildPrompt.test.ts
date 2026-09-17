import {
  describe, expect, it
} from 'vitest';

import type { EscalationTopic } from '@interfaces/knowledge.js';
import { buildTurnPrompt } from '@services/turn/BuildPrompt.js';

const TOPICS: EscalationTopic[] = [
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
];

const userContent = (messages: { content: string }[]): string =>
  messages[messages.length - 1]?.content ?? '';

describe('buildTurnPrompt',
  () => {
    it('wraps the customer name in a delimited record block',
      () => {
        const messages = buildTurnPrompt({
          userMessage: 'Hi',
          history: [],
          customerName: 'Juan',
          topics: TOPICS,
        });

        expect(userContent(messages)).toContain('<customer_record>\nName: Juan\n</customer_record>');
      });

    it('wraps the topic list and state summary in delimited blocks',
      () => {
        const messages = buildTurnPrompt({
          userMessage: 'Hi',
          history: [],
          stateSummary: 'Current stage: New; known slots: {}',
          topics: TOPICS,
        });

        const content = userContent(messages);
        expect(content).toContain('<topic_list>\nORCR: OR/CR (keywords: orcr, or/cr)\n</topic_list>');
        expect(content).toContain('<state_summary>\nCurrent stage: New; known slots: {}\n</state_summary>');
      });

    it('omits the customer and state blocks when they are absent',
      () => {
        const messages = buildTurnPrompt({
          userMessage: 'Hi',
          history: [],
          topics: TOPICS,
        });

        const content = userContent(messages);
        expect(content).not.toContain('<customer_record>');
        expect(content).not.toContain('<state_summary>');
        expect(content).toContain('<topic_list>');
      });
  });
