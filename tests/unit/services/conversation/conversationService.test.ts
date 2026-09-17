import { fakeAiProviderConfig } from '@fakes/fakeAiProviderConfig.js';
import { FakeLlmProvider } from '@fakes/fakeLlmProvider.js';
import { FakePersistence } from '@fakes/fakePersistence.js';
import { RunStatus } from '@enums/RunStatus.js';
import type {
  ChatResponse,
  DetectLanguageRequest,
  DetectLanguageResponse,
  LlmProvider,
} from '@interfaces/llm.js';
import { createConversationService } from '@services/conversation/ConversationService.js';
import {
  describe, expect, it 
} from 'vitest';

class FailingLlmProvider extends FakeLlmProvider {
  override chat(): Promise<ChatResponse> {
    return Promise.reject(new Error('llm boom'));
  }
}

class FailingLanguageDetector extends FakeLlmProvider {
  override detectLanguage(_request: DetectLanguageRequest): Promise<DetectLanguageResponse> {
    return Promise.reject(new Error('detector down'));
  }
}

const setup = (llm: LlmProvider = new FakeLlmProvider({ config: fakeAiProviderConfig })) => {
  const persistence = new FakePersistence();
  const service = createConversationService({
    persistence,
    llm 
  });

  return {
    persistence,
    service 
  };
};

const threadIdFor = async (
  persistence: FakePersistence,
  ticketId: string,
): Promise<string> => {
  const thread = await persistence.threads.findByTicketId(ticketId);
  if (thread === null) throw new Error(`thread for "${ticketId}" was not created`);
  return thread.id;
};

describe('createConversationService',
  () => {
    it('creates a thread and returns the minimal contract with a detected language',
      async () => {
        const {
          service, persistence 
        } = setup(new FakeLlmProvider({
          config: fakeAiProviderConfig,
          detectLanguageResult: {
            language: 'Taglish',
            confidence: 0.8 
          },
        }));

        const result = await service.handle({
          ticketId: 'TK-00001',
          request: {
            latestMessage: {
              externalId: 'mid_1',
              role: 'user',
              body: 'Magkano po?',
            },
            customer: { displayName: 'Juan' },
          },
        });

        expect(result.reply).toBe('fake assistant reply');
        expect(result.replyToExternalId).toBe('mid_1');
        expect(result.transferToAgent).toBeNull();
        expect(result.media).toBeNull();
        expect(result.route).toBe('ai');
        expect(result.aiRouted).toBe(true);
        expect(result.language).toBe('Taglish');
        expect(result.usage).toEqual({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        });

        const threadId = await threadIdFor(persistence, 'TK-00001');
        const messages = await persistence.messages.listByThread(threadId);
        expect(messages.items.map((message) => message.role)).toEqual([
          'user',
          'assistant'
        ]);
      });

    it('reuses the thread for the same ticket',
      async () => {
        const {
          service, persistence 
        } = setup();

        await service.handle({
          ticketId: 'TK-1',
          request: {
            latestMessage: {
              role: 'user',
              body: 'a' 
            } 
          },
        });
        await service.handle({
          ticketId: 'TK-1',
          request: {
            latestMessage: {
              role: 'user',
              body: 'b' 
            } 
          },
        });

        const threads = await persistence.threads.listByTicketId('TK-1');
        expect(threads.total).toBe(1);
      });

    it('dedupes context history and the latest message by externalId',
      async () => {
        const {
          service, persistence 
        } = setup();
        const request = {
          contextHistory: [
            {
              externalId: 'mid_0',
              role: 'user' as const,
              body: 'first',
            },
          ],
          latestMessage: {
            externalId: 'mid_1',
            role: 'user' as const,
            body: 'hello',
          },
        };

        await service.handle({
          ticketId: 'TK-2',
          request 
        });
        await service.handle({
          ticketId: 'TK-2',
          request 
        });

        const threadId = await threadIdFor(persistence, 'TK-2');
        const messages = await persistence.messages.listByThread(threadId);
        expect(messages.items.filter((message) => message.role === 'user')).toHaveLength(2);
        expect(messages.items.filter((message) => message.role === 'assistant')).toHaveLength(2);
      });

    it('records a completed run',
      async () => {
        const {
          service, persistence 
        } = setup();

        await service.handle({
          ticketId: 'TK-3',
          request: {
            latestMessage: {
              role: 'user',
              body: 'hi' 
            } 
          },
        });

        const threadId = await threadIdFor(persistence, 'TK-3');
        const runs = await persistence.runs.listByThread(threadId);
        expect(runs.total).toBe(1);
        expect(runs.items[0]?.type).toBe('response');
        expect(runs.items[0]?.status).toBe(RunStatus.Completed);
        expect(runs.items[0]?.completedAt).toBeDefined();
      });

    it('degrades language to null when detection fails but still replies',
      async () => {
        const {service} = setup(new FailingLanguageDetector({ config: fakeAiProviderConfig }));

        const result = await service.handle({
          ticketId: 'TK-5',
          request: {
            latestMessage: {
              role: 'user',
              body: 'hi' 
            } 
          },
        });

        expect(result.reply).toBe('fake assistant reply');
        expect(result.language).toBeNull();
      });

    it('records a failed run and rethrows when the LLM errors',
      async () => {
        const {
          service, persistence 
        } = setup(new FailingLlmProvider({ config: fakeAiProviderConfig }));

        await expect(service.handle({
          ticketId: 'TK-4',
          request: {
            latestMessage: {
              role: 'user',
              body: 'hi' 
            } 
          },
        })).rejects.toThrow('llm boom');

        const threadId = await threadIdFor(persistence, 'TK-4');
        const runs = await persistence.runs.listByThread(threadId);
        expect(runs.items[0]?.status).toBe(RunStatus.Failed);
        expect(runs.items[0]?.error).toBe('llm boom');
      });
  });
