import {
  describe, expect, it 
} from 'vitest';

import type { ChatMessage } from '@interfaces/llm.js';
import {
  RESPONSE_AGENT_SYSTEM_PROMPT, RESPONSE_AGENT_VERSION, buildResponseAgentMessages
} from '@prompts/ResponseAgent.js';

describe('RESPONSE_AGENT_SYSTEM_PROMPT',
  () => {
    it('defines the MotorCentral persona',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('MotorCentral');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('empathic');
      });

    it('enforces language matching',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('Tagalog');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('Taglish');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('SAME language');
      });

    it('marks the agent read-only and forbids invented data',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('READ-ONLY');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('NEVER invent');
      });

    it('names the context blocks',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('<customer_context>');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('<knowledge_context>');
      });

    it('carries no hardcoded catalog data',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).not.toContain('GCash');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).not.toContain('OR/CR');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).not.toContain('Discounts');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).not.toContain('jotform.com');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).not.toContain('Helmet');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).not.toContain('₱');
      });

    it('declares the snake_case structured-output contract',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('schema_version');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('state_transition');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('RESTRICTED_TOPIC');
      });

    it('lists the template-key catalog with the splice marker rule',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('greeting.initial');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('pricing.ask_variant');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('pricing.ask_payment_type');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('price.installment');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('price.cash');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('freebies.installment');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('freebies.cash');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('freebies.bajaj');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('application.jotform_link');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('fallback.general');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('{{template}}');
      });

    it('documents the slot contract and the escalation rule',
      () => {
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('product_query');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('selected_variant_id');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('payment_preference');
        expect(RESPONSE_AGENT_SYSTEM_PROMPT).toContain('escalation.topic_key');
      });
  });

describe('RESPONSE_AGENT_VERSION',
  () => {
    it('is versioned for run provenance',
      () => {
        expect(RESPONSE_AGENT_VERSION).toBe(2);
      });
  });

describe('buildResponseAgentMessages',
  () => {
    it('puts the system prompt first',
      () => {
        const messages = buildResponseAgentMessages({ userMessage: 'Hi' });

        expect(messages[0]).toEqual({
          role: 'system',
          content: RESPONSE_AGENT_SYSTEM_PROMPT,
        });
      });

    it('appends the user message without context when none is given',
      () => {
        const messages = buildResponseAgentMessages({ userMessage: 'Hello po' });

        expect(messages).toHaveLength(2);
        expect(messages[1]).toEqual({
          role: 'user',
          content: 'Hello po' 
        });
      });

    it('injects the tagged context blocks before the user message',
      () => {
        const messages = buildResponseAgentMessages({
          userMessage: 'Magkano po?',
          context: {
            customerContext: 'Repeat customer',
            inventoryContext: 'Click 125 cash ₱84,850',
            knowledgeContext: 'Cash freebies list',
          },
        });

        const content = messages[1]?.content ?? '';
        expect(content).toContain('<customer_context>\nRepeat customer\n</customer_context>');
        expect(content).toContain('<inventory_context>\nClick 125 cash ₱84,850\n</inventory_context>');
        expect(content).toContain('<knowledge_context>\nCash freebies list\n</knowledge_context>');
        expect(content).toContain('Magkano po?');
      });

    it('only injects the context blocks that are provided',
      () => {
        const messages = buildResponseAgentMessages({
          userMessage: 'Hi',
          context: { inventoryContext: 'Click 125' },
        });

        const content = messages[1]?.content ?? '';
        expect(content).toContain('<inventory_context>');
        expect(content).not.toContain('<customer_context>');
        expect(content).not.toContain('<knowledge_context>');
      });

    it('preserves prior history between the system and user messages',
      () => {
        const history: ChatMessage[] = [
          {
            role: 'user',
            content: 'first' 
          },
          {
            role: 'assistant',
            content: 'reply' 
          },
        ];

        const messages = buildResponseAgentMessages({
          userMessage: 'second',
          history,
        });

        expect(messages).toHaveLength(4);
        expect(messages[1]).toEqual(history[0]);
        expect(messages[2]).toEqual(history[1]);
        expect(messages[3]).toEqual({
          role: 'user',
          content: 'second' 
        });
      });
  });
