import {
  describe, expect, it 
} from 'vitest';

import { AttachmentPurpose } from '@enums/AttachmentPurpose.js';
import { ConversationStage } from '@enums/ConversationStage.js';
import { DecisionAction } from '@enums/DecisionAction.js';
import { validateDecision } from '@services/decision/DecisionValidator.js';
import {
  aiDecisionWireSchema,
  parseAiDecisionWire,
} from '@services/decision/DecisionSchema.js';
import { buildFallbackDecision } from '@services/decision/FallbackDecision.js';
import { AppError } from '@utils/errors.js';

const wirePayload = (): Record<string, unknown> => ({
  schema_version: 1,
  intent: 'PRODUCT_PRICE_INQUIRY',
  action: DecisionAction.Respond,
  confidence: 0.9,
  language: 'Tagalog',
  response: {
    message: 'Magkano po ang Click?',
    template_key: 'price.installment',
    attachments: [
      {
        type: 'image',
        url: 'https://cdn.example.com/click.png',
        name: 'click.png',
        purpose: AttachmentPurpose.ProductVariant,
        reference: {
          kind: 'variant',
          id: 'variant-1' 
        },
      },
    ],
  },
  escalation: null,
  state_transition: {
    stage: ConversationStage.Quoted,
    set: {
      source: 'llm',
      count: 1,
      flag: true,
      empty: null 
    },
  },
  memory_updates: [
    {
      op: 'upsert',
      key: 'budget',
      value: '50000',
      source: 'customer_stated',
      confidence: 0.9 
    },
  ],
  knowledge_used: [
    {
      key: 'price.click125',
      version: 2 
    },
  ],
  metadata: {
    model: 'chat-model-v1',
    prompt_key: 'response',
    prompt_version: 1,
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15 
    },
    latency_ms: 120,
  },
});

const parseErrorOf = (raw: unknown): AppError => {
  try {
    parseAiDecisionWire(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error('Expected parseAiDecisionWire to throw');
};

describe('aiDecisionWireSchema',
  () => {
    it('parses a full snake_case payload into a camelCase AiDecision',
      () => {
        expect(parseAiDecisionWire(wirePayload())).toEqual({
          schemaVersion: 1,
          intent: 'PRODUCT_PRICE_INQUIRY',
          action: DecisionAction.Respond,
          confidence: 0.9,
          language: 'Tagalog',
          response: {
            message: 'Magkano po ang Click?',
            templateKey: 'price.installment',
            attachments: [
              {
                type: 'image',
                url: 'https://cdn.example.com/click.png',
                name: 'click.png',
                purpose: AttachmentPurpose.ProductVariant,
                reference: {
                  kind: 'variant',
                  id: 'variant-1' 
                },
              },
            ],
          },
          escalation: null,
          stateTransition: {
            stage: ConversationStage.Quoted,
            set: {
              source: 'llm',
              count: 1,
              flag: true,
              empty: null 
            },
          },
          memoryUpdates: [
            {
              op: 'upsert',
              key: 'budget',
              value: '50000',
              source: 'customer_stated',
              confidence: 0.9 
            },
          ],
          knowledgeUsed: [
            {
              key: 'price.click125',
              version: 2 
            },
          ],
          metadata: {
            model: 'chat-model-v1',
            promptKey: 'response',
            promptVersion: 1,
            usage: {
              promptTokens: 10,
              completionTokens: 5,
              totalTokens: 15 
            },
            latencyMs: 120,
          },
        });
      });

    it('accepts a JSON-string payload',
      () => {
        const decision = parseAiDecisionWire(JSON.stringify(wirePayload()));

        expect(decision.intent).toBe('PRODUCT_PRICE_INQUIRY');
        expect(decision.response.templateKey).toBe('price.installment');
      });

    it('accepts a minimal payload without optional sections',
      () => {
        const decision = parseAiDecisionWire({
          schema_version: 1,
          intent: 'GREETING',
          action: DecisionAction.Respond,
          confidence: 0.5,
          language: 'English',
          response: { message: 'Hello!' },
          escalation: null,
        });

        expect(decision.response.attachments).toEqual([]);
        expect(decision.stateTransition).toBeUndefined();
        expect(decision.memoryUpdates).toBeUndefined();
      });

    it('strips unknown keys',
      () => {
        const decision = parseAiDecisionWire({
          ...wirePayload(),
          extra_root: 'dropped',
        });

        expect(decision).not.toHaveProperty('extra_root');
      });

    it.each([
      [
        'bad action',
        'action',
        { action: 99 },
      ],
      [
        'bad language',
        'language',
        { language: 'Cebuano' },
      ],
      [
        'confidence above 1',
        'confidence',
        { confidence: 1.5 },
      ],
      [
        'missing message',
        'response.message',
        { response: { attachments: [] } },
      ],
      [
        'bad attachment url',
        'response.attachments.0.url',
        {
          response: {
            message: 'see photo',
            attachments: [
              {
                type: 'image',
                url: 'not-a-url',
                purpose: AttachmentPurpose.Other 
              },
            ],
          },
        },
      ],
    ])('rejects %s with a path-scoped AppError',
      (_label, path, override) => {
        const error = parseErrorOf({
          ...wirePayload(),
          ...override,
        });

        expect(error.code).toBe('DECISION_PARSE_ERROR');
        expect(error.message).toContain(path);
      });

    it('rejects a non-JSON string without dumping the payload',
      () => {
        const error = parseErrorOf('{{{not json');

        expect(error.code).toBe('DECISION_PARSE_ERROR');
        expect(error.message).toContain('not valid JSON');
      });

    it('never echoes unrelated payload fields in the error message',
      () => {
        const error = parseErrorOf({
          ...wirePayload(),
          action: 99,
          response: {
            message: 'SECRET_MARKER_NEVER_ECHOED',
            attachments: [] 
          },
        });

        expect(error.message).toContain('action');
        expect(error.message).not.toContain('SECRET_MARKER_NEVER_ECHOED');
      });

    it('round-trips the fallback decision through the wire schema',
      () => {
        const fallback = buildFallbackDecision('parse');

        expect(fallback).toMatchObject({
          schemaVersion: 1,
          intent: 'GENERAL_INQUIRY',
          action: DecisionAction.Respond,
          confidence: 0,
          language: 'Tagalog',
          escalation: null,
        });
        const wire = {
          schema_version: fallback.schemaVersion,
          intent: fallback.intent,
          action: fallback.action,
          confidence: fallback.confidence,
          language: fallback.language,
          response: {
            message: fallback.response.message,
            attachments: [],
          },
          escalation: fallback.escalation,
        };
        expect(aiDecisionWireSchema.safeParse(wire).success).toBe(true);
      });

    it('validateDecision falls back on unparsable input',
      () => {
        const result = validateDecision('{{{not json', {});

        expect(result.fallback).toBe(true);
        expect(result.validation.valid).toBe(false);
        expect(result.validation.errors).toHaveLength(1);
        expect(result.greeting).toBe(false);
      });
  });
