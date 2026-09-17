import {
  describe, expect, it
} from 'vitest';

import { ConversationStage } from '@enums/ConversationStage.js';
import { DecisionAction } from '@enums/DecisionAction.js';
import { KnowledgeContentType } from '@enums/KnowledgeContentType.js';
import { FakeKnowledgeService } from '@fakes/fakeKnowledgeService.js';
import { FakePersistence } from '@fakes/fakePersistence.js';
import type { EscalationTopic } from '@interfaces/knowledge.js';
import { applyDecision } from '@services/turn/ValidateAndApply.js';

const GUARD_TOPIC: EscalationTopic = {
  key: 'ORCR',
  label: 'OR/CR',
  keywords: [
    'orcr',
    'or/cr'
  ],
  department: 'REGISTRATION',
  priority: 'HIGH',
  fallbackTemplateKey: 'fallback.escalation',
};

const ASK_VARIANT_TEMPLATE = {
  key: 'pricing.ask_variant',
  title: 'Ask variant',
  content: 'Alin po sa mga ito ang gusto niyo?\n\n{{variant_list}}',
  contentType: KnowledgeContentType.Template,
  variables: [],
  triggers: [],
  version: 1,
};

const setup = async () => {
  const persistence = new FakePersistence();
  const knowledge = new FakeKnowledgeService({ templates: [ASK_VARIANT_TEMPLATE] });
  const thread = await persistence.threads.create({
    ticketId: 'TK-coerced',
    route: 'ai',
  });
  const run = await persistence.runs.create({
    threadId: thread.id,
    type: 'response',
    input: {},
  });

  return {
    persistence,
    knowledge,
    thread,
    runId: run.id,
  };
};

const baseInput = {
  guardHit: null,
  isFirstAssistantTurn: false,
  language: null,
  usage: null,
  model: undefined,
  latencyMs: 0,
  replyToExternalId: null,
  baseKnowledgeUsed: [],
};

describe('applyDecision state merge',
  () => {
    it('persists the validator-coerced guard escalation set, not the raw parse set',
      async () => {
        const {
          persistence, knowledge, thread, runId 
        } = await setup();

        const result = await applyDecision({
          persistence,
          knowledge,
          thread,
          state: null,
          runId,
          rawDecision: {
            schema_version: 1,
            intent: 'GENERAL_INQUIRY',
            action: DecisionAction.Respond,
            confidence: 0.9,
            language: 'Tagalog',
            response: {
              message: 'placeholder',
              attachments: [],
            },
            escalation: null,
            state_transition: {
              stage: ConversationStage.New,
              set: { product_query: 'click' },
            },
          },
          ...baseInput,
          guardHit: GUARD_TOPIC,
        });

        expect(result.transferToAgent).toBe(true);
        const state = await persistence.conversationStates.findByThread(thread.id);
        expect(state?.stage).toBe(ConversationStage.Escalated);
        expect(state?.data).toEqual({ escalation_topic: 'ORCR' });
        const escalations = await persistence.escalations.listByThread(thread.id);
        expect(escalations.total).toBe(1);
        expect(escalations.items[0]).toMatchObject({ topicKey: 'ORCR' });
      });

    it('persists the coerced AskClarification stage with the carried-over set',
      async () => {
        const {
          persistence, knowledge, thread, runId 
        } = await setup();

        const result = await applyDecision({
          persistence,
          knowledge,
          thread,
          state: null,
          runId,
          rawDecision: {
            schema_version: 1,
            intent: 'PRODUCT_PRICE_INQUIRY',
            action: DecisionAction.Respond,
            confidence: 0.9,
            language: 'Tagalog',
            response: {
              message: 'Eto po:\n\n{{template}}',
              template_key: 'price.installment',
              attachments: [],
            },
            escalation: null,
            state_transition: {
              stage: ConversationStage.Quoted,
              set: { product_query: 'click' },
            },
          },
          ...baseInput,
        });

        expect(result.transferToAgent).toBe(false);
        expect(result.reply).toContain('V4 STD');
        const state = await persistence.conversationStates.findByThread(thread.id);
        expect(state?.stage).toBe(ConversationStage.AwaitingVariant);
        expect(state?.data).toEqual({ product_query: 'click' });
      });
  });
