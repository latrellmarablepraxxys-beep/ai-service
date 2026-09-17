import {
  AIMessage, HumanMessage, SystemMessage, ToolMessage 
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { z } from 'zod';

import type { AiProviderConfig } from '../../interfaces/aiProvider.js';
import type { HealthStatus } from '../../interfaces/cache.js';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ClassifyRequest,
  ClassifyResponse,
  CreateChatModelOptions,
  CreateEmbeddingModelOptions,
  DetectLanguageRequest,
  DetectLanguageResponse,
  FinishReason,
  LlmErrorCode,
  LlmProvider,
  TokenUsage,
} from '../../interfaces/llm.js';
import { buildLanguageDetectorMessages } from '../../prompts/LanguageDetector.js';
import { AppError, isAppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { createChatModel } from './ChatModel.js';
import { createEmbeddingModel } from './EmbeddingModel.js';

const extractContent = (content: unknown): string =>
  typeof content === 'string' ? content : JSON.stringify(content);

/** Pulls the first JSON object out of a model reply, tolerating ```json fences. */
const extractJsonObject = (content: string): unknown => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const candidate = (fenced?.[1] ?? content).trim();
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    // Unparseable output is an invalid response, not a transport failure.
    return undefined;
  }
};

const languageDetectionSchema = z.object({
  language: z.enum([
    'English',
    'Tagalog',
    'Taglish'
  ]),
  confidence: z.number().min(0).max(1),
});

const toFinishReason = (value: unknown): FinishReason =>
  value === 'stop' || value === 'length' || value === 'tool_calls' || value === 'content_filter'
    ? value
    : 'stop';

const toTokenUsage = (metadata: unknown): TokenUsage | undefined => {
  if (typeof metadata !== 'object' || metadata === null) return undefined;
  const {
    input_tokens: promptTokens,
    output_tokens: completionTokens,
    total_tokens: totalTokens,
  } = metadata as Record<string, unknown>;
  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    return undefined;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens 
  };
};

const TIMEOUT_MESSAGE_PATTERN = /timed?\s*out|timeout/i;

const LLM_ERROR_CODES = new Set<string>([
  'LLM_REQUEST_FAILED',
  'LLM_TIMEOUT',
  'LLM_CANCELLED',
  'LLM_RATE_LIMITED',
  'LLM_AUTHENTICATION_ERROR',
  'LLM_NOT_FOUND',
  'LLM_CONTEXT_LENGTH_EXCEEDED',
  'LLM_INVALID_RESPONSE',
  'LLM_EMBEDDING_FAILED',
]);

/** Narrowing guard — an `AppError.code` is a string, only some values are `LlmErrorCode`. */
const isLlmErrorCode = (code: string): code is LlmErrorCode => LLM_ERROR_CODES.has(code);

const isCancellation = (error: Error, signal: AbortSignal | undefined): boolean =>
  signal?.aborted === true || error.name === 'AbortError';

const toLlmError = (error: unknown, message: string, signal?: AbortSignal): AppError => {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    // A cancelled request is NOT a timeout: report it distinctly (HTTP 499).
    if (isCancellation(error, signal)) {
      return new AppError('LLM_CANCELLED', 499, message, { cause: error.message });
    }
    // Narrow match on genuine timeout wording only — never a generic 'abort'.
    if (TIMEOUT_MESSAGE_PATTERN.test(error.message)) {
      return new AppError('LLM_TIMEOUT', 504, message, { cause: error.message });
    }
    return new AppError('LLM_REQUEST_FAILED', 503, message, { cause: error.message });
  }
  return new AppError('LLM_REQUEST_FAILED', 503, message);
};

const toBaseMessage = (message: ChatMessage): BaseMessage => {
  const name = message.name !== undefined ? { name: message.name } : {};
  switch (message.role) {
    case 'system':
      return new SystemMessage({
        content: message.content,
        ...name 
      });
    case 'user':
      return new HumanMessage({
        content: message.content,
        ...name 
      });
    case 'assistant':
      return new AIMessage({
        content: message.content,
        ...name 
      });
    case 'tool':
      return new ToolMessage({
        content: message.content,
        tool_call_id: message.toolCallId ?? '',
        ...name,
      });
  }
};

/**
 * Identity of a chat model configuration. Two requests resolve to the same
 * model instance iff their key is equal, so the wrapped `ChatOpenAI` is built
 * at most once per distinct option set.
 */
const chatModelKey = (options: CreateChatModelOptions): string =>
  JSON.stringify([
    options.model ?? options.config.models.chat,
    options.temperature ?? null,
    options.maxTokens ?? null,
    options.responseFormat ?? null,
  ]);

const embeddingModelKey = (options: CreateEmbeddingModelOptions): string =>
  options.model ?? options.config.models.embedding;

export const createLlmProvider = (config: AiProviderConfig): LlmProvider => {
  // Models are built lazily: `@langchain/openai` throws at construction when the
  // api key is blank, so a provider used for embeddings only (or chat only) must
  // never touch the other model. `createLlmProvider` itself never throws.
  const chatModels = new Map<string, ChatOpenAI>();
  const embeddingModels = new Map<string, OpenAIEmbeddings>();

  const getChatModel = (options: CreateChatModelOptions): ChatOpenAI => {
    const key = chatModelKey(options);
    const cached = chatModels.get(key);
    if (cached !== undefined) return cached;
    const model = createChatModel(options);
    chatModels.set(key, model);
    return model;
  };

  const getEmbeddingModel = (options: CreateEmbeddingModelOptions): OpenAIEmbeddings => {
    const key = embeddingModelKey(options);
    const cached = embeddingModels.get(key);
    if (cached !== undefined) return cached;
    const model = createEmbeddingModel(options);
    embeddingModels.set(key, model);
    return model;
  };

  const resolveChatModel = (request: ChatRequest): ChatOpenAI => {
    const hasOverrides =
      request.temperature !== undefined ||
      request.maxTokens !== undefined ||
      (request.model !== undefined && request.model !== config.models.chat);
    if (!hasOverrides) return getChatModel({ config });
    return getChatModel({
      config,
      ...(request.model !== undefined && { model: request.model }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.maxTokens !== undefined && { maxTokens: request.maxTokens }),
    });
  };

  // exactOptionalPropertyTypes: keep `signal` out of the options object when absent.
  const toCallOptions = (request: ChatRequest): { signal?: AbortSignal } =>
    request.signal !== undefined ? { signal: request.signal } : {};

  const buildMessages = (messages: ChatMessage[]): BaseMessage[] => messages.map(toBaseMessage);

  return {
    config,

    async chat(request: ChatRequest): Promise<ChatResponse> {
      const model = resolveChatModel(request);
      try {
        const result = await model.invoke(buildMessages(request.messages), toCallOptions(request));
        return {
          content: extractContent(result.content),
          model: request.model ?? config.models.chat,
          finishReason: toFinishReason(result.response_metadata?.finish_reason),
          usage: toTokenUsage(result.usage_metadata),
        };
      } catch (error) {
        throw toLlmError(error, 'LLM chat request failed', request.signal);
      }
    },

    async *chatStream(request: ChatRequest) {
      const model = resolveChatModel(request);
      try {
        const stream = await model.stream(buildMessages(request.messages), toCallOptions(request));
        let finishReason: FinishReason = 'stop';
        let usage: TokenUsage | undefined;
        for await (const chunk of stream) {
          const content = extractContent(chunk.content);
          if (content.length > 0) {
            yield {
              type: 'delta',
              content 
            };
          }
          finishReason = toFinishReason(chunk.response_metadata?.finish_reason);
          const chunkUsage = toTokenUsage(chunk.usage_metadata);
          if (chunkUsage !== undefined) {
            usage = chunkUsage;
          }
        }
        yield {
          type: 'done',
          finishReason,
          usage 
        };
      } catch (error) {
        const appError = toLlmError(error, 'LLM chat stream failed', request.signal);
        // Guard the cast: AppError.code is a string; fall back if it isn't a
        // known LlmErrorCode so the error chunk can never carry a lying code.
        const code: LlmErrorCode = isLlmErrorCode(appError.code)
          ? appError.code
          : 'LLM_REQUEST_FAILED';
        yield {
          type: 'error',
          code,
          message: appError.message 
        };
      }
    },

    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      try {
        return await getEmbeddingModel({ config }).embedDocuments(texts);
      } catch (error) {
        if (isAppError(error)) throw error;
        const cause = error instanceof Error ? error.message : undefined;
        throw new AppError(
          'LLM_EMBEDDING_FAILED',
          502,
          'LLM embedding request failed',
          cause !== undefined ? { cause } : undefined,
        );
      }
    },

    async health(): Promise<HealthStatus> {
      // Cheapest possible probe: one tiny embedding validates the embeddings
      // endpoint specifically (not the chat model). The getter is the same lazy,
      // memoized one `embed()` uses, so a healthy probe warms nothing extra.
      const start = performance.now();
      try {
        await getEmbeddingModel({ config }).embedDocuments(['ping']);
        return {
          connected: true,
          latencyMs: Math.round(performance.now() - start) 
        };
      } catch (error) {
        // Graceful degradation, matching the other adapters — a probe reports
        // itself down, it never throws and never 500s the route.
        logger.warn({ err: error }, 'LLM health check failed');
        return {
          connected: false,
          latencyMs: undefined 
        };
      }
    },

    // TODO(P4.1): classifier prompt + structured-output schema land in the next phase.
    // Deliberately `async`: the 501 must surface as a rejected promise, never a
    // synchronous throw, even though the stub has nothing to await yet.
    // eslint-disable-next-line @typescript-eslint/require-await
    async classify(_request: ClassifyRequest): Promise<ClassifyResponse> {
      throw new AppError('LLM_REQUEST_FAILED', 501, 'classify is not implemented yet');
    },

    async detectLanguage(request: DetectLanguageRequest): Promise<DetectLanguageResponse> {
      const model = getChatModel({
        config,
        model: request.model ?? config.models.classifier,
        temperature: 0,
        responseFormat: 'json_object',
      });

      try {
        const detectorMessages = buildLanguageDetectorMessages({
          text: request.text,
          ...(request.context !== undefined && { context: request.context }),
        });
        const callOptions = request.signal !== undefined ? { signal: request.signal } : {};
        const result = await model.invoke(buildMessages(detectorMessages), callOptions);

        const parsed = languageDetectionSchema.safeParse(
          extractJsonObject(extractContent(result.content)),
        );
        if (!parsed.success) {
          throw new AppError(
            'LLM_INVALID_RESPONSE',
            502,
            'Language detection returned an invalid response',
          );
        }

        return {
          language: parsed.data.language,
          confidence: parsed.data.confidence,
        };
      } catch (error) {
        throw toLlmError(error, 'LLM language detection failed', request.signal);
      }
    },
  };
};
