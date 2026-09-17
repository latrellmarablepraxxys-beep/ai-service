import {
  describe, expect, it 
} from 'vitest';

import { AttachmentPurpose } from '@enums/AttachmentPurpose.js';
import { ConversationStage } from '@enums/ConversationStage.js';
import { DecisionAction } from '@enums/DecisionAction.js';
import { KnowledgeContentType } from '@enums/KnowledgeContentType.js';
import { RunStatus } from '@enums/RunStatus.js';
import { fakeAiProviderConfig } from '@fakes/fakeAiProviderConfig.js';
import { FakeKnowledgeService } from '@fakes/fakeKnowledgeService.js';
import { FakeLlmProvider } from '@fakes/fakeLlmProvider.js';
import { FakePersistence } from '@fakes/fakePersistence.js';
import type {
  CatalogProduct,
  KnowledgeEntry,
} from '@interfaces/knowledge.js';
import type {
  ChatRequest,
  ChatResponse,
  LlmProvider,
} from '@interfaces/llm.js';
import { createConversationService } from '@services/conversation/ConversationService.js';
import { createTurnPipeline } from '@services/turn/TurnPipeline.js';

const template = (key: string, content: string): KnowledgeEntry => ({
  key,
  title: key,
  content,
  contentType: KnowledgeContentType.Template,
  variables: [],
  triggers: [],
  version: 1,
});

const TEMPLATES: KnowledgeEntry[] = [
  template(
    'greeting.initial',
    'Good day Kaibigan! Welcome po sa {{branch_page}}. Ano po ang aking maitutulong?',
  ),
  template(
    'greeting.initial_en',
    'Good day! Welcome to Motorcentral. How may I help you?',
  ),
  template(
    'pricing.ask_variant',
    'Mayroon po kaming dalawang version ng {{product_name}}. Alin po sa mga ito ang gusto niyo?\n\n{{variant_list}}',
  ),
  template(
    'pricing.ask_payment_type',
    'Salamat po! Gusto niyo po bang malaman ang installment o cash price?',
  ),
  template(
    'fallback.general',
    'Pasensya na po — pakiulit po ang inyong tanong, o ikokonekta ko po kayo sa aming team member na makakatulong.',
  ),
  template(
    'fallback.escalation',
    'Salamat po sa inyong tanong. Ikokonekta ko po kayo sa aming team member na makakatulong po sa inyo.',
  ),
  template(
    'application.jotform_link',
    'Narito po ang online application form: https://form.jotform.com/241562824952461',
  ),
  template(
    'freebies.kaibigan_merchants',
    '🏍 Motoworld - Sta. Rosa, Laguna\n☕ Musikape - Biñan, Laguna',
  ),
];

const PRODUCTS: CatalogProduct[] = [
  {
    id: '1',
    name: 'Honda Click 125',
    brand: 'Honda',
    variants: [
      {
        id: 'variant-std',
        productId: '1',
        productName: 'Honda Click 125',
        variantName: 'V4 STD',
        imageUrl: 'https://cdn.motorcentral.ph/products/click125-v4-std.png',
        cashPrice: 84_850,
        minDownpayment: 6_700,
        updatedPaymentLess: 200,
        terms: [
          {
            termMonths: 12,
            monthlyAmount: 9_105,
          },
          {
            termMonths: 24,
            monthlyAmount: 5_395,
          },
          {
            termMonths: 36,
            monthlyAmount: 4_250,
          }
        ],
      },
      {
        id: 'variant-se',
        productId: '1',
        productName: 'Honda Click 125',
        variantName: 'V4 SE',
        imageUrl: null,
        cashPrice: null,
        minDownpayment: null,
        updatedPaymentLess: null,
        terms: [],
      }
    ],
  }
];

const wireDecision = (overrides: Record<string, unknown>): string => JSON.stringify({
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
  ...overrides,
});

class CountingLlmProvider extends FakeLlmProvider {
  chatCalls = 0;

  override chat(request: ChatRequest): Promise<ChatResponse> {
    this.chatCalls += 1;
    return super.chat(request);
  }
}

const setup = (chatContent: string, llm?: LlmProvider) => {
  const persistence = new FakePersistence();
  const knowledge = new FakeKnowledgeService({
    templates: TEMPLATES,
    products: PRODUCTS,
  });
  const provider = llm ?? new FakeLlmProvider({
    config: fakeAiProviderConfig,
    chatResponse: { content: chatContent },
  });
  const pipeline = createTurnPipeline({
    persistence,
    llm: provider,
    knowledge,
  });
  const service = createConversationService({ pipeline });

  return {
    persistence,
    service,
  };
};

const stageFor = async (persistence: FakePersistence, ticketId: string): Promise<ConversationStage> => {
  const thread = await persistence.threads.findByTicketId(ticketId);
  if (thread === null) throw new Error(`thread for "${ticketId}" was not created`);
  const state = await persistence.conversationStates.findByThread(thread.id);
  if (state === null) throw new Error(`state for "${ticketId}" was not persisted`);
  return state.stage;
};

describe('turn pipeline',
  () => {
    it('splices the first-turn greeting and persists stage Greeted',
      async () => {
        const {
          service, persistence 
        } = setup(wireDecision({
          intent: 'GREETING',
          response: {
            message: 'Hi!',
            template_key: 'greeting.initial',
            attachments: [],
          },
        }));

        const result = await service.handle({
          ticketId: 'TK-greet',
          request: {
            latestMessage: {
              externalId: 'mid_1',
              role: 'user',
              body: 'Kamusta po!',
            },
          },
        });

        expect(result.reply).toContain('Motorcentral Muntinlupa Page');
        expect(result.replyToExternalId).toBe('mid_1');
        expect(result.transferToAgent).toBe(false);
        expect(result.route).toBe('ai');
        expect(await stageFor(persistence, 'TK-greet')).toBe(ConversationStage.Greeted);
      });

    it('asks for the variant when two match, persisting stage AwaitingVariant',
      async () => {
        const {
          service, persistence 
        } = setup(wireDecision({
          intent: 'PRODUCT_PRICE_INQUIRY',
          response: {
            message: 'Eto po:\n\n{{template}}',
            template_key: 'price.installment',
            attachments: [],
          },
          state_transition: {
            stage: ConversationStage.Quoted,
            set: { product_query: 'click' },
          },
        }));

        const result = await service.handle({
          ticketId: 'TK-variant',
          request: {
            latestMessage: {
              role: 'user',
              body: 'Magkano po ang Click 125?',
            },
          },
        });

        expect(result.reply).toContain('V4 STD');
        expect(result.reply).toContain('V4 SE');
        expect(await stageFor(persistence, 'TK-variant')).toBe(ConversationStage.AwaitingVariant);
      });

    it('renders the installment block with a variant image attachment and stage Quoted',
      async () => {
        const {
          service, persistence 
        } = setup(wireDecision({
          intent: 'INSTALLMENT_PRICE_INQUIRY',
          response: {
            message: 'Eto po ang installment:\n\n{{template}}',
            template_key: 'price.installment',
            attachments: [],
          },
          state_transition: {
            stage: ConversationStage.Quoted,
            set: {
              product_query: 'click',
              selected_variant_id: 'variant-std',
              payment_preference: 'installment',
            },
          },
          knowledge_used: [
            {
              key: 'catalog:variant:variant-std',
              version: 1,
            }
          ],
        }));

        const result = await service.handle({
          ticketId: 'TK-installment',
          request: {
            latestMessage: {
              role: 'user',
              body: 'Installment po, V4 STD',
            },
          },
        });

        expect(result.reply).toContain('₱6,700');
        expect(result.reply).toContain('₱9,105');
        expect(result.attachments).toEqual([
          {
            type: 'image',
            url: 'https://cdn.motorcentral.ph/products/click125-v4-std.png',
            name: 'Honda Click 125 V4 STD',
            purpose: AttachmentPurpose.ProductVariant,
            reference: {
              kind: 'product_variant',
              id: 'variant-std',
            },
          }
        ]);
        expect(await stageFor(persistence, 'TK-installment')).toBe(ConversationStage.Quoted);

        const thread = await persistence.threads.findByTicketId('TK-installment');
        if (thread === null) throw new Error('thread was not created');
        const decisions = await persistence.decisions.listByThread(thread.id);
        expect(decisions.total).toBe(1);
        const knowledgeUsed = decisions.items[0]?.decision as { knowledgeUsed?: { key: string }[] };
        expect(knowledgeUsed.knowledgeUsed?.map((ref) => ref.key)).toContain('catalog:variant:variant-std');
      });

    it('renders the freebies package with merchants and stage FreebiesSent',
      async () => {
        const {
          service, persistence 
        } = setup(wireDecision({
          intent: 'FREEBIES_INQUIRY',
          response: {
            message: 'Eto po ang freebies:\n\n{{template}}',
            template_key: 'freebies.installment',
            attachments: [],
          },
          state_transition: {
            stage: ConversationStage.FreebiesSent,
            set: { payment_preference: 'installment' },
          },
        }));

        const result = await service.handle({
          ticketId: 'TK-freebies',
          request: {
            latestMessage: {
              role: 'user',
              body: 'Ano po ang freebies?',
            },
          },
        });

        expect(result.reply).toContain('Free Motorcentral Half Face Helmet.');
        expect(result.reply).toContain('Motoworld');
        expect(await stageFor(persistence, 'TK-freebies')).toBe(ConversationStage.FreebiesSent);
      });

    it('escalates a restricted topic without calling the LLM',
      async () => {
        const counting = new CountingLlmProvider({ config: fakeAiProviderConfig });
        const {
          service, persistence 
        } = setup('unused', counting);

        const result = await service.handle({
          ticketId: 'TK-escalate',
          request: {
            latestMessage: {
              role: 'user',
              body: 'Nasaan na po ang OR/CR ko?',
            },
          },
        });

        expect(result.transferToAgent).toBe(true);
        expect(result.route).toBe('agent');
        expect(result.aiRouted).toBe(false);
        expect(counting.chatCalls).toBe(0);

        const thread = await persistence.threads.findByTicketId('TK-escalate');
        if (thread === null) throw new Error('thread was not created');
        const escalations = await persistence.escalations.listByThread(thread.id);
        expect(escalations.total).toBe(1);
        expect(escalations.items[0]).toMatchObject({ topicKey: 'ORCR' });
        expect(await stageFor(persistence, 'TK-escalate')).toBe(ConversationStage.Escalated);
        const escalatedState = await persistence.conversationStates.findByThread(thread.id);
        expect(escalatedState?.data['escalation_topic']).toBe('ORCR');
      });

    it('renders the fallback line when the LLM returns invalid JSON',
      async () => {
        const {
          service, persistence 
        } = setup('{{{not json');

        const result = await service.handle({
          ticketId: 'TK-fallback',
          request: {
            latestMessage: {
              role: 'user',
              body: '???',
            },
          },
        });

        expect(result.reply).toBe(
          'Pasensya na po — pakiulit po ang inyong tanong, o ikokonekta ko po kayo sa aming team member na makakatulong.',
        );

        const thread = await persistence.threads.findByTicketId('TK-fallback');
        if (thread === null) throw new Error('thread was not created');
        const decisions = await persistence.decisions.listByThread(thread.id);
        expect(decisions.total).toBe(1);
        expect(decisions.items[0]?.fallback).toBe(true);
      });

    it('completes the run with provenance and links the assistant message',
      async () => {
        const {
          service, persistence 
        } = setup(wireDecision({
          intent: 'INSTALLMENT_PRICE_INQUIRY',
          response: {
            message: 'Eto po ang installment:\n\n{{template}}',
            template_key: 'price.installment',
            attachments: [],
          },
          state_transition: {
            stage: ConversationStage.Quoted,
            set: {
              product_query: 'click',
              selected_variant_id: 'variant-std',
              payment_preference: 'installment',
            },
          },
        }));

        const result = await service.handle({
          ticketId: 'TK-run',
          request: {
            latestMessage: {
              role: 'user',
              body: 'Installment po, V4 STD',
            },
          },
        });

        expect(result.usage).toEqual({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        });

        const thread = await persistence.threads.findByTicketId('TK-run');
        if (thread === null) throw new Error('thread was not created');
        const runs = await persistence.runs.listByThread(thread.id);
        expect(runs.total).toBe(1);
        const run = runs.items[0];
        expect(run?.status).toBe(RunStatus.Completed);
        expect(run?.promptKey).toBe('response_agent');
        expect(run?.promptVersion).toBe(2);
        expect(run?.usage).toEqual({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        });
        expect(run?.knowledgeUsed?.map((ref) => ref.key)).toEqual(
          expect.arrayContaining([
            'escalation_topics',
            'greeting.initial',
            'catalog:variant:variant-std'
          ]),
        );

        const messages = await persistence.messages.listByThread(thread.id);
        const assistant = messages.items.find((message) => message.role === 'assistant');
        expect(assistant?.metadata['aiRunId']).toBe(run?.id);
      });

    it('marks the run Failed when a persistence write fails mid-turn',
      async () => {
        const persistence = new FakePersistence();
        persistence.decisions.create = (): Promise<never> =>
          Promise.reject(new Error('decisions unavailable'));
        const knowledge = new FakeKnowledgeService({
          templates: TEMPLATES,
          products: PRODUCTS,
        });
        const provider = new FakeLlmProvider({
          config: fakeAiProviderConfig,
          chatResponse: { content: wireDecision({ intent: 'GREETING' }) },
        });
        const pipeline = createTurnPipeline({
          persistence,
          llm: provider,
          knowledge,
        });
        const service = createConversationService({ pipeline });

        await expect(service.handle({
          ticketId: 'TK-failed-write',
          request: {
            latestMessage: {
              role: 'user',
              body: 'Kamusta po!',
            },
          },
        })).rejects.toThrow('decisions unavailable');

        const thread = await persistence.threads.findByTicketId('TK-failed-write');
        if (thread === null) throw new Error('thread was not created');
        const runs = await persistence.runs.listByThread(thread.id);
        expect(runs.total).toBe(1);
        expect(runs.items[0]?.status).toBe(RunStatus.Failed);
      });

    it('persists one copy when context_history and latest share an external id',
      async () => {
        const {
          service, persistence 
        } = setup(wireDecision({ intent: 'GREETING' }));

        await service.handle({
          ticketId: 'TK-dedupe',
          request: {
            contextHistory: [
              {
                externalId: 'dup_1',
                role: 'user',
                body: 'Kamusta po!',
              }
            ],
            latestMessage: {
              externalId: 'dup_1',
              role: 'user',
              body: 'Kamusta po!',
            },
          },
        });

        const thread = await persistence.threads.findByTicketId('TK-dedupe');
        if (thread === null) throw new Error('thread was not created');
        const messages = await persistence.messages.listByThread(thread.id);
        const inbound = messages.items.filter(
          (message) => message.role === 'user' && message.metadata['externalId'] === 'dup_1',
        );
        expect(inbound).toHaveLength(1);
      });
  });
