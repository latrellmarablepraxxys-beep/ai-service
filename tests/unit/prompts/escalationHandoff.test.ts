import {
  describe, expect, it 
} from 'vitest';

import {ESCALATION_HANDOFF_SYSTEM_PROMPT, buildEscalationHandoffMessages} from '@prompts/EscalationHandoff.js';

describe('ESCALATION_HANDOFF_SYSTEM_PROMPT',
  () => {
    it('requires the labelled sections',
      () => {
        for (const section of [
          'LANGUAGE:',
          'TRIGGER:',
          'CUSTOMER:',
          'SUMMARY:',
          'CONTEXT:',
          'NEXT STEP:',
        ]) {
          expect(ESCALATION_HANDOFF_SYSTEM_PROMPT).toContain(section);
        }
      });

    it('insists on the language section for agent continuity',
      () => {
        expect(ESCALATION_HANDOFF_SYSTEM_PROMPT).toContain('Always include the LANGUAGE section');
      });

    it('forbids inventing details and answering the escalated question',
      () => {
        expect(ESCALATION_HANDOFF_SYSTEM_PROMPT).toContain('Never invent');
        expect(ESCALATION_HANDOFF_SYSTEM_PROMPT).toContain('Do not answer the customer');
      });
  });

describe('buildEscalationHandoffMessages',
  () => {
    it('includes the trigger topic and customer message',
      () => {
        const messages = buildEscalationHandoffMessages({
          userMessage: 'Paano po ang GCash payment?',
          triggerTopic: 'GCash Payment',
        });

        const content = messages[1]?.content ?? '';
        expect(content).toContain('Trigger topic: GCash Payment');
        expect(content).toContain('Paano po ang GCash payment?');
      });

    it('includes the language, customer context, and summary when provided',
      () => {
        const messages = buildEscalationHandoffMessages({
          userMessage: 'question',
          triggerTopic: 'OR/CR',
          language: 'Taglish',
          customerContext: 'Repeat buyer',
          conversationSummary: 'Asked about Click 125',
        });

        const content = messages[1]?.content ?? '';
        expect(content).toContain('Customer language: Taglish');
        expect(content).toContain('<customer_context>\nRepeat buyer\n</customer_context>');
        expect(content).toContain('<conversation_summary>\nAsked about Click 125\n</conversation_summary>');
      });

    it('omits optional sections when not provided',
      () => {
        const messages = buildEscalationHandoffMessages({
          userMessage: 'question',
          triggerTopic: 'Discount',
        });

        const content = messages[1]?.content ?? '';
        expect(content).not.toContain('Customer language:');
        expect(content).not.toContain('<customer_context>');
        expect(content).not.toContain('<conversation_summary>');
      });
  });
