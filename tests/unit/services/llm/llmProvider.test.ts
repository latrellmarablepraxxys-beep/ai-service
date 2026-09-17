import {
  describe, beforeEach, expect, it, vi 
} from 'vitest';

import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';

import type { AiProviderConfig } from '@interfaces/aiProvider.js';
import type {
  ChatStreamChunk,
  CreateChatModelOptions,
  CreateEmbeddingModelOptions,
} from '@interfaces/llm.js';
import { createLlmProvider } from '@services/llm/LlmProvider.js';
import { createChatModel } from '@services/llm/ChatModel.js';
import { createEmbeddingModel } from '@services/llm/EmbeddingModel.js';
import { AppError } from '@utils/errors.js';

const mocks = vi.hoisted(() => ({
  chatModel: {
    invoke: vi.fn(),
    stream: vi.fn() 
  },
  embeddingModel: { embedDocuments: vi.fn() },
}));

// Mirror `@langchain/openai`: constructing a model with a blank api key throws.
vi.mock('@services/llm/ChatModel.js',
  () => ({
    createChatModel: vi.fn((options: CreateChatModelOptions) => {
      if (options.config.apiKey.trim().length === 0) {
        throw new Error('OpenAI API key is required');
      }
      return mocks.chatModel;
    }),
  }));

vi.mock('@services/llm/EmbeddingModel.js',
  () => ({
    createEmbeddingModel: vi.fn((options: CreateEmbeddingModelOptions) => {
      if (options.config.embeddings.apiKey.trim().length === 0) {
        throw new Error('OpenAI API key is required');
      }
      return mocks.embeddingModel;
    }),
  }));

const config: AiProviderConfig = {
  provider: 'openai',
  driver: 'openai',
  baseUrl: 'https://chat.example.com/v1',
  apiKey: 'chat-secret',
  models: {
    chat: 'chat-model-v1',
    classifier: 'classifier-model-v1',
    embedding: 'embed-model-v1',
  },
  embeddings: {
    baseUrl: 'https://embeddings.example.com/v1',
    apiKey: 'embed-secret',
    dimensions: 256,
    supportsDimensions: true,
  },
};

const ChatModelMock = vi.mocked(createChatModel);
const EmbeddingModelMock = vi.mocked(createEmbeddingModel);

describe('llmProvider',
  () => {
    beforeEach(() => {
      ChatModelMock.mockClear();
      EmbeddingModelMock.mockClear();
      mocks.chatModel.invoke.mockReset();
      mocks.chatModel.stream.mockReset();
      mocks.embeddingModel.embedDocuments.mockReset();
    });

    it('exposes the passed config',
      () => {
        const provider = createLlmProvider(config);

        expect(provider.config).toBe(config);
      });

    it('does not build chat or embedding models on construction (lazy)',
      () => {
        createLlmProvider(config);

        expect(ChatModelMock).not.toHaveBeenCalled();
        expect(EmbeddingModelMock).not.toHaveBeenCalled();
      });

    it('constructs with a blank chat key without throwing, and embeds without the chat model',
      async () => {
        const blankChatConfig: AiProviderConfig = {
          ...config,
          apiKey: '' 
        };

        // The chat model factory throws on a blank key — construction must not call it.
        expect(() => createLlmProvider(blankChatConfig)).not.toThrow();

        const provider = createLlmProvider(blankChatConfig);
        mocks.embeddingModel.embedDocuments.mockResolvedValue([
          [
            0.1,
            0.2
          ]
        ]);

        await expect(provider.embed(['health check'])).resolves.toEqual([
          [
            0.1,
            0.2
          ]
        ]);
        expect(ChatModelMock).not.toHaveBeenCalled();
        expect(EmbeddingModelMock).toHaveBeenCalledTimes(1);
      });

    it('chats without ever building the embedding model',
      async () => {
        const provider = createLlmProvider(config);
        mocks.chatModel.invoke.mockResolvedValue({
          content: 'ok',
          response_metadata: { finish_reason: 'stop' },
        });

        await provider.chat({
          messages: [
            {
              role: 'user',
              content: 'hi' 
            }
          ] 
        });

        expect(ChatModelMock).toHaveBeenCalledTimes(1);
        expect(EmbeddingModelMock).not.toHaveBeenCalled();
      });

    it('builds the chat model at most once per distinct option set',
      async () => {
        const provider = createLlmProvider(config);
        mocks.chatModel.invoke.mockResolvedValue({
          content: 'ok',
          response_metadata: { finish_reason: 'stop' },
        });

        await provider.chat({
          messages: [
            {
              role: 'user',
              content: 'a' 
            }
          ] 
        });
        await provider.chat({
          messages: [
            {
              role: 'user',
              content: 'b' 
            }
          ] 
        });
        expect(ChatModelMock).toHaveBeenCalledTimes(1);

        await provider.chat({
          messages: [
            {
              role: 'user',
              content: 'c' 
            }
          ],
          temperature: 0.2 
        });
        await provider.chat({
          messages: [
            {
              role: 'user',
              content: 'd' 
            }
          ],
          temperature: 0.2 
        });
        expect(ChatModelMock).toHaveBeenCalledTimes(2);
      });

    it('builds the embedding model at most once',
      async () => {
        const provider = createLlmProvider(config);
        mocks.embeddingModel.embedDocuments.mockResolvedValue([[0.1]]);

        await provider.embed(['a']);
        await provider.embed(['b']);

        expect(EmbeddingModelMock).toHaveBeenCalledTimes(1);
      });

    describe('chat()',
      () => {
        it('maps the model response to a ChatResponse',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: 'hello there',
              response_metadata: { finish_reason: 'stop' },
              usage_metadata: {
                input_tokens: 12,
                output_tokens: 5,
                total_tokens: 17 
              },
            });

            const response = await provider.chat({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
            });

            expect(response).toEqual({
              content: 'hello there',
              model: 'chat-model-v1',
              finishReason: 'stop',
              usage: {
                promptTokens: 12,
                completionTokens: 5,
                totalTokens: 17 
              },
            });
            expect(mocks.chatModel.invoke).toHaveBeenCalledTimes(1);
          });

        it('builds LangChain messages preserving role and name',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: 'ok',
              response_metadata: { finish_reason: 'stop' },
            });

            await provider.chat({
              messages: [
                {
                  role: 'system',
                  content: 'be brief' 
                },
                {
                  role: 'user',
                  content: 'hi',
                  name: 'caller' 
                },
                {
                  role: 'assistant',
                  content: 'previous reply' 
                },
                {
                  role: 'tool',
                  content: 'tool output',
                  toolCallId: 'call-1' 
                },
              ],
            });

            const messages = mocks.chatModel.invoke.mock.calls[0]?.[0] as BaseMessage[] | undefined;
            expect(messages).toHaveLength(4);
            expect(messages?.[0]).toBeInstanceOf(SystemMessage);
            expect(messages?.[0]?.content).toBe('be brief');
            expect(messages?.[1]).toBeInstanceOf(HumanMessage);
            expect(messages?.[1]?.name).toBe('caller');
            expect(messages?.[2]).toBeInstanceOf(AIMessage);
            expect(messages?.[2]?.content).toBe('previous reply');
            expect(messages?.[3]).toBeInstanceOf(ToolMessage);
            expect(messages?.[3]?.content).toBe('tool output');
          });

        it('maps finish_reason length and stringifies complex content',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: [
                {
                  type: 'text',
                  text: 'long' 
                }
              ],
              response_metadata: { finish_reason: 'length' },
            });

            const response = await provider.chat({
              messages: [
                {
                  role: 'user',
                  content: 'x' 
                }
              ] 
            });

            expect(response.finishReason).toBe('length');
            expect(response.content).toBe(JSON.stringify([
              {
                type: 'text',
                text: 'long' 
              }
            ]));
            expect(response.usage).toBeUndefined();
          });

        it('honours a per-request model override',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: 'x',
              response_metadata: { finish_reason: 'stop' },
            });

            const response = await provider.chat({
              messages: [
                {
                  role: 'user',
                  content: 'x' 
                }
              ],
              model: 'override-model',
            });

            expect(ChatModelMock).toHaveBeenCalledWith({
              config,
              model: 'override-model' 
            });
            expect(response.model).toBe('override-model');
          });

        it('maps failures to LLM_REQUEST_FAILED 503',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockRejectedValue(new Error('boom'));

            await expect(provider.chat({ messages: [] })).rejects.toMatchObject({
              code: 'LLM_REQUEST_FAILED',
              status: 503,
            });
          });

        it('maps non-Error failures to LLM_REQUEST_FAILED 503',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockRejectedValue('plain string failure');

            await expect(provider.chat({ messages: [] })).rejects.toMatchObject({
              code: 'LLM_REQUEST_FAILED',
              status: 503,
            });
          });

        it('maps timeout failures to LLM_TIMEOUT 504',
          async () => {
            const provider = createLlmProvider(config);

            mocks.chatModel.invoke.mockRejectedValue(new Error('request timed out'));
            await expect(provider.chat({ messages: [] })).rejects.toMatchObject({
              code: 'LLM_TIMEOUT',
              status: 504,
            });
          });

        it('maps an AbortError to LLM_CANCELLED 499, not a timeout',
          async () => {
            const provider = createLlmProvider(config);

            mocks.chatModel.invoke.mockRejectedValue(
              Object.assign(new Error('aborted'), { name: 'AbortError' }),
            );
            await expect(provider.chat({ messages: [] })).rejects.toMatchObject({
              code: 'LLM_CANCELLED',
              status: 499,
            });
          });

        it('maps an aborted request signal to LLM_CANCELLED 499',
          async () => {
            const provider = createLlmProvider(config);
            const controller = new AbortController();
            controller.abort();
            mocks.chatModel.invoke.mockRejectedValue(new Error('This operation was aborted'));

            await expect(
              provider.chat({
                messages: [],
                signal: controller.signal 
              }),
            ).rejects.toMatchObject({
              code: 'LLM_CANCELLED',
              status: 499,
            });
          });

        it('passes the request signal through to the model call options',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: 'ok',
              response_metadata: { finish_reason: 'stop' },
            });
            const controller = new AbortController();

            await provider.chat({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
              signal: controller.signal,
            });

            expect(mocks.chatModel.invoke).toHaveBeenCalledWith(expect.any(Array),
              {signal: controller.signal,});
          });
      });

    describe('chatStream()',
      () => {
        it('yields deltas then a terminal done chunk',
          async () => {
            const provider = createLlmProvider(config);
            const generator = function* () {
              yield { content: 'Hel' };
              yield { content: 'lo' };
              yield {
                content: '',
                response_metadata: { finish_reason: 'length' },
                usage_metadata: {
                  input_tokens: 3,
                  output_tokens: 2,
                  total_tokens: 5 
                },
              };
            };
            mocks.chatModel.stream.mockResolvedValue(generator());

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
            })) {
              chunks.push(chunk);
            }

            expect(chunks).toEqual([
              {
                type: 'delta',
                content: 'Hel' 
              },
              {
                type: 'delta',
                content: 'lo' 
              },
              {
                type: 'done',
                finishReason: 'length',
                usage: {
                  promptTokens: 3,
                  completionTokens: 2,
                  totalTokens: 5 
                },
              },
            ]);
          });

        it('defaults done to finishReason stop and undefined usage when absent',
          async () => {
            const provider = createLlmProvider(config);
            const generator = function* () {
              yield { content: 'x' };
            };
            mocks.chatModel.stream.mockResolvedValue(generator());

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
            })) {
              chunks.push(chunk);
            }

            expect(chunks).toEqual([
              {
                type: 'delta',
                content: 'x' 
              },
              {
                type: 'done',
                finishReason: 'stop',
                usage: undefined 
              },
            ]);
          });

        it('yields an error chunk when the stream throws',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.stream.mockRejectedValue(new Error('network down'));

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
            })) {
              chunks.push(chunk);
            }

            expect(chunks).toEqual([
              {
                type: 'error',
                code: 'LLM_REQUEST_FAILED',
                message: 'LLM chat stream failed' 
              },
            ]);
          });

        it('yields a timeout error chunk on stream timeouts',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.stream.mockRejectedValue(new Error('timed out'));

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
            })) {
              chunks.push(chunk);
            }

            expect(chunks).toEqual([
              {
                type: 'error',
                code: 'LLM_TIMEOUT',
                message: 'LLM chat stream failed' 
              },
            ]);
          });

        it('falls back to LLM_REQUEST_FAILED when the thrown AppError code is not a known LlmErrorCode',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.stream.mockRejectedValue(new AppError('NOT_A_LLM_CODE', 500, 'boom'));

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
            })) {
              chunks.push(chunk);
            }

            expect(chunks).toEqual([
              {
                type: 'error',
                code: 'LLM_REQUEST_FAILED',
                message: 'boom' 
              }
            ]);
          });

        it('yields deltas then exactly one error chunk when the stream throws mid-stream',
          async () => {
            const provider = createLlmProvider(config);
            const generator = (function* () {
              yield { content: 'partial' };
              yield { content: 'reply' };
              throw new Error('mid-stream boom');
            })();
            mocks.chatModel.stream.mockResolvedValue(generator);

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
            })) {
              chunks.push(chunk);
            }

            // No `done` chunk, no unhandled rejection — the error chunk is terminal.
            expect(chunks).toEqual([
              {
                type: 'delta',
                content: 'partial' 
              },
              {
                type: 'delta',
                content: 'reply' 
              },
              {
                type: 'error',
                code: 'LLM_REQUEST_FAILED',
                message: 'LLM chat stream failed' 
              },
            ]);
          });

        it('yields a cancelled error chunk when the stream is aborted',
          async () => {
            const provider = createLlmProvider(config);
            const controller = new AbortController();
            controller.abort();
            mocks.chatModel.stream.mockRejectedValue(
              Object.assign(new Error('aborted'), { name: 'AbortError' }),
            );

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
              signal: controller.signal,
            })) {
              chunks.push(chunk);
            }

            expect(chunks).toEqual([
              {
                type: 'error',
                code: 'LLM_CANCELLED',
                message: 'LLM chat stream failed' 
              },
            ]);
          });

        it('passes the request signal through to the stream call options',
          async () => {
            const provider = createLlmProvider(config);
            const generator = (function* () {
              yield { content: 'x' };
            })();
            mocks.chatModel.stream.mockResolvedValue(generator);
            const controller = new AbortController();

            const chunks: ChatStreamChunk[] = [];
            for await (const chunk of provider.chatStream({
              messages: [
                {
                  role: 'user',
                  content: 'hi' 
                }
              ],
              signal: controller.signal,
            })) {
              chunks.push(chunk);
            }

            expect(mocks.chatModel.stream).toHaveBeenCalledWith(expect.any(Array),
              {signal: controller.signal,});
          });
      });

    describe('embed()',
      () => {
        it('short-circuits empty input without a network call',
          async () => {
            const provider = createLlmProvider(config);

            await expect(provider.embed([])).resolves.toEqual([]);
            expect(mocks.embeddingModel.embedDocuments).not.toHaveBeenCalled();
          });

        it('embeds texts through the embedding model',
          async () => {
            const provider = createLlmProvider(config);
            mocks.embeddingModel.embedDocuments.mockResolvedValue([
              [
                0.1,
                0.2
              ],
              [
                0.3,
                0.4
              ],
            ]);

            await expect(provider.embed([
              'a',
              'b'
            ])).resolves.toEqual([
              [
                0.1,
                0.2
              ],
              [
                0.3,
                0.4
              ],
            ]);
            expect(mocks.embeddingModel.embedDocuments).toHaveBeenCalledWith([
              'a',
              'b'
            ]);
          });

        it('maps embedding failures to LLM_EMBEDDING_FAILED 502',
          async () => {
            const provider = createLlmProvider(config);
            mocks.embeddingModel.embedDocuments.mockRejectedValue(new Error('embed boom'));

            await expect(provider.embed(['a'])).rejects.toMatchObject({
              code: 'LLM_EMBEDDING_FAILED',
              status: 502,
            });
          });
      });

    describe('health()',
      () => {
        it('reports connected with a numeric latency when the embeddings probe resolves',
          async () => {
            const provider = createLlmProvider(config);
            mocks.embeddingModel.embedDocuments.mockResolvedValue([[0.1]]);

            const status = await provider.health();

            expect(status.connected).toBe(true);
            expect(status.latencyMs).toBeTypeOf('number');
            expect(mocks.embeddingModel.embedDocuments).toHaveBeenCalledWith(['ping']);
          });

        it('reports disconnected without throwing when the embeddings probe rejects',
          async () => {
            const provider = createLlmProvider(config);
            mocks.embeddingModel.embedDocuments.mockRejectedValue(new Error('embed down'));

            const status = await provider.health();

            expect(status).toEqual({
              connected: false,
              latencyMs: undefined 
            });
          });
      });

    describe('detectLanguage()',
      () => {
        it('binds the classifier model with JSON output',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: '{"language":"English","confidence":0.5}',
              response_metadata: { finish_reason: 'stop' },
            });

            await provider.detectLanguage({ text: 'hello' });

            expect(ChatModelMock).toHaveBeenCalledWith(expect.objectContaining({
              model: 'classifier-model-v1',
              responseFormat: 'json_object',
            }));
          });

        it('returns the parsed language and confidence',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: '{"language":"Tagalog","confidence":0.9}',
              response_metadata: { finish_reason: 'stop' },
            });

            await expect(provider.detectLanguage({ text: 'Magkano po?' })).resolves.toEqual({
              language: 'Tagalog',
              confidence: 0.9,
            });
          });

        it('parses a fenced JSON reply',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: '```json\n{"language":"Taglish","confidence":0.7}\n```',
              response_metadata: { finish_reason: 'stop' },
            });

            await expect(provider.detectLanguage({ text: 'sige po' })).resolves.toEqual({
              language: 'Taglish',
              confidence: 0.7,
            });
          });

        it('rejects with LLM_INVALID_RESPONSE when the reply is not valid JSON',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: 'not json',
              response_metadata: { finish_reason: 'stop' },
            });

            await expect(provider.detectLanguage({ text: 'hi' })).rejects.toMatchObject({
              code: 'LLM_INVALID_RESPONSE',
              status: 502,
            });
          });

        it('rejects with LLM_INVALID_RESPONSE when the language is not allowed',
          async () => {
            const provider = createLlmProvider(config);
            mocks.chatModel.invoke.mockResolvedValue({
              content: '{"language":"Cebuano","confidence":0.9}',
              response_metadata: { finish_reason: 'stop' },
            });

            await expect(provider.detectLanguage({ text: 'hi' })).rejects.toMatchObject({
              code: 'LLM_INVALID_RESPONSE',
              status: 502,
            });
          });
      });

    describe('classify()',
      () => {
        it('is not implemented yet — rejects with 501',
          async () => {
            const provider = createLlmProvider(config);

            await expect(provider.classify({ text: 'route me' })).rejects.toMatchObject({
              code: 'LLM_REQUEST_FAILED',
              status: 501,
              message: 'classify is not implemented yet',
            });
          });
      });
  });
