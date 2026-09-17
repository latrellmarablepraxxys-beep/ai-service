import {
  describe, expect, it 
} from 'vitest';

import { ConversationStage } from '@enums/ConversationStage.js';
import { DecisionAction } from '@enums/DecisionAction.js';
import type { EscalationTopic } from '@interfaces/knowledge.js';
import { validateDecision } from '@services/decision/DecisionValidator.js';

const guardHit: EscalationTopic = {
  key: 'gcash-payment',
  label: 'GCash payment',
  keywords: ['gcash'],
  department: 'Payments',
  priority: 'HIGH',
  fallbackTemplateKey: 'escalation.payments',
};

const decisionRaw = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema_version: 1,
  intent: 'GENERAL_INQUIRY',
  action: DecisionAction.Respond,
  confidence: 0.8,
  language: 'Tagalog',
  response: {
    message: 'Kumusta po!',
    attachments: [] 
  },
  escalation: null,
  ...overrides,
});

const priceRaw = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
  decisionRaw({
    intent: 'PRODUCT_PRICE_INQUIRY',
    response: {
      message: 'Narito po ang presyo.',
      template_key: 'price.installment',
      attachments: [] 
    },
    state_transition: {
      stage: ConversationStage.Quoted,
      set: { source: 'llm' },
    },
    ...overrides,
  });

const matchingEscalationRaw = (): Record<string, unknown> =>
  decisionRaw({
    intent: 'RESTRICTED_TOPIC',
    action: DecisionAction.Escalate,
    response: {
      message: 'Ikokonekta ko po kayo sa aming team.',
      template_key: 'escalation.payments',
      attachments: [] 
    },
    escalation: {
      topic_key: guardHit.key,
      reason: 'Customer asked about GCash',
      department: 'Payments',
      priority: 'HIGH',
      summary: 'GCash inquiry.',
    },
  });

describe('validateDecision',
  () => {
    it('returns a parse fallback for unparsable input',
      () => {
        const result = validateDecision('{{{not json');

        expect(result.fallback).toBe(true);
        expect(result.validation).toEqual({
          valid: false,
          errors: [result.validation.errors[0]],
        });
        expect(result.validation.errors).toHaveLength(1);
        expect(result.greeting).toBe(false);
      });

    it('post-check A: a deterministic guard hit coerces a Respond into an escalation',
      () => {
        const result = validateDecision(decisionRaw(), { guardHit });

        expect(result.fallback).toBe(false);
        expect(result.validation).toEqual({
          valid: true,
          errors: [],
        });
        expect(result.decision.action).toBe(DecisionAction.Escalate);
        expect(result.decision.escalation).toEqual({
          topicKey: 'gcash-payment',
          reason: 'Restricted topic matched deterministically',
          department: 'Payments',
          priority: 'HIGH',
          summary: 'Customer message matched restricted topic gcash-payment.',
        });
        expect(result.decision.response).toEqual({
          message: '',
          templateKey: 'escalation.payments',
          attachments: [],
        });
        expect(result.decision.stateTransition).toEqual({
          stage: ConversationStage.Escalated,
          set: { escalation_topic: 'gcash-payment' },
        });
      });

    it('post-check A: leaves a matching deterministic escalation untouched',
      () => {
        const before = matchingEscalationRaw();
        const result = validateDecision(before, { guardHit });

        expect(result.fallback).toBe(false);
        expect(result.decision.action).toBe(DecisionAction.Escalate);
        expect(result.decision.escalation?.topicKey).toBe('gcash-payment');
        expect(result.decision.response.templateKey).toBe('escalation.payments');
      });

    it('post-check B: an LLM escalation without a deterministic topic falls back',
      () => {
        const result = validateDecision(
          decisionRaw({
            action: DecisionAction.Escalate,
            escalation: {
              topic_key: 'claimed-topic',
              reason: 'LLM claimed this',
              department: 'Support',
              priority: 'LOW',
              summary: 'Untrusted escalation.',
            },
          }),
        );

        expect(result.fallback).toBe(true);
        expect(result.validation.valid).toBe(false);
        expect(result.validation.errors).toEqual(['LLM escalation references an unknown topic',]);
      });

    it('post-check B: rewrites a mismatched escalation to the guard topic',
      () => {
        const result = validateDecision(
          decisionRaw({
            action: DecisionAction.Escalate,
            escalation: {
              topic_key: 'other-topic',
              reason: 'LLM guessed',
              department: 'Support',
              priority: 'LOW',
              summary: 'Wrong topic.',
            },
          }),
          { guardHit },
        );

        expect(result.fallback).toBe(false);
        expect(result.decision.action).toBe(DecisionAction.Escalate);
        expect(result.decision.escalation?.topicKey).toBe('gcash-payment');
        expect(result.decision.response.templateKey).toBe('escalation.payments');
      });

    it('post-check C: asks the payment type when a price quote lacks a preference',
      () => {
        const result = validateDecision(priceRaw());

        expect(result.fallback).toBe(false);
        expect(result.decision.action).toBe(DecisionAction.AskClarification);
        expect(result.decision.response.templateKey).toBe('pricing.ask_payment_type');
        expect(result.decision.stateTransition).toEqual({
          stage: ConversationStage.AwaitingPaymentType,
          set: { source: 'llm' },
        });
      });

    it('post-check C: keeps the quote when a payment preference is known',
      () => {
        const result = validateDecision(priceRaw(), { paymentPreference: 'cash' });

        expect(result.decision.action).toBe(DecisionAction.Respond);
        expect(result.decision.response.templateKey).toBe('price.installment');
      });

    it('post-check C: ignores non-price templates',
      () => {
        const result = validateDecision(
          priceRaw({
            response: {
              message: 'Narito po ang freebies.',
              template_key: 'freebies.list',
              attachments: [] 
            },
          }),
        );

        expect(result.decision.action).toBe(DecisionAction.Respond);
      });

    it('post-check D: asks the variant when several match and none is selected',
      () => {
        const result = validateDecision(priceRaw(), {
          variantCount: 2,
          paymentPreference: 'installment',
        });

        expect(result.decision.action).toBe(DecisionAction.AskClarification);
        expect(result.decision.response.templateKey).toBe('pricing.ask_variant');
        expect(result.decision.stateTransition?.stage).toBe(ConversationStage.AwaitingVariant);
      });

    it('post-check D: keeps the quote when a variant is already selected',
      () => {
        const result = validateDecision(priceRaw(), {
          variantCount: 2,
          selectedVariantId: 'variant-1',
          paymentPreference: 'installment',
        });

        expect(result.decision.action).toBe(DecisionAction.Respond);
      });

    it('variant gating beats payment gating when both answers are missing',
      () => {
        const result = validateDecision(priceRaw(), { variantCount: 3 });

        expect(result.decision.action).toBe(DecisionAction.AskClarification);
        expect(result.decision.response.templateKey).toBe('pricing.ask_variant');
        expect(result.decision.stateTransition?.stage).toBe(ConversationStage.AwaitingVariant);
      });

    it('variant and payment gating only apply to price intents',
      () => {
        const result = validateDecision(decisionRaw(), { variantCount: 2 });

        expect(result.decision.action).toBe(DecisionAction.Respond);
      });

    it('variant and payment gating only apply to Respond decisions',
      () => {
        const result = validateDecision(
          priceRaw({ action: DecisionAction.Noop }),
          { variantCount: 2 },
        );

        expect(result.decision.action).toBe(DecisionAction.Noop);
      });

    it('post-check E: flags the first assistant turn as a greeting',
      () => {
        expect(validateDecision(decisionRaw(), { isFirstAssistantTurn: true }).greeting).toBe(true);
        expect(validateDecision(decisionRaw(), { isFirstAssistantTurn: false }).greeting).toBe(
          false,
        );
        expect(validateDecision(decisionRaw()).greeting).toBe(false);
      });

    it('post-check F: prunes low-confidence inferred updates but keeps the decision valid',
      () => {
        const result = validateDecision(
          decisionRaw({
            memory_updates: [
              {
                op: 'upsert',
                key: 'weak-guess',
                source: 'ai_inferred',
                confidence: 0.5 
              },
              {
                op: 'upsert',
                key: 'strong-guess',
                source: 'ai_inferred',
                confidence: 0.9 
              },
              {
                op: 'upsert',
                key: 'stated-fact',
                source: 'customer_stated',
                confidence: 0.2 
              },
            ],
          }),
        );

        expect(result.fallback).toBe(false);
        expect(result.validation).toEqual({
          valid: true,
          errors: [],
        });
        expect(result.decision.memoryUpdates?.map((entry) => entry.key)).toEqual([
          'strong-guess',
          'stated-fact',
        ]);
      });
  });
