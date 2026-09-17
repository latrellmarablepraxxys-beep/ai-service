import type { AiProviderConfig } from './aiProvider.js';
import type { HealthStatus } from './cache.js';
import type { TicketRoute } from './domain.js';

export type LlmErrorCode =
  | 'LLM_REQUEST_FAILED'
  | 'LLM_TIMEOUT'
  | 'LLM_CANCELLED'
  | 'LLM_RATE_LIMITED'
  | 'LLM_AUTHENTICATION_ERROR'
  | 'LLM_NOT_FOUND'
  | 'LLM_CONTEXT_LENGTH_EXCEEDED'
  | 'LLM_INVALID_RESPONSE'
  | 'LLM_EMBEDDING_FAILED';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | undefined;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

export interface ChatResponse {
  content: string;
  model: string;
  finishReason: FinishReason;
  usage: TokenUsage | undefined;
}

/**
 * Chunk envelope for `chatStream`.
 *
 * An `error` chunk is TERMINAL: it is always the last chunk of the stream.
 * Consumers must not expect a subsequent `done` chunk after an `error`.
 */
export type ChatStreamChunk =
  | { type: 'delta'; content: string }
  | { type: 'done'; finishReason: FinishReason; usage: TokenUsage | undefined }
  | { type: 'error'; code: LlmErrorCode; message: string };

export interface ClassifyRequest {
  text: string;
  context?: string;
  model?: string;
  signal?: AbortSignal;
}

export interface ClassifyResponse {
  route: TicketRoute;
  confidence: number;
  reasoning: string | undefined;
}

export type DetectedLanguage = 'English' | 'Tagalog' | 'Taglish';

export interface DetectLanguageRequest {
  text: string;
  context?: string;
  model?: string;
  signal?: AbortSignal;
}

export interface DetectLanguageResponse {
  language: DetectedLanguage;
  confidence: number;
}

export interface LlmProvider {
  config: AiProviderConfig;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
  classify(request: ClassifyRequest): Promise<ClassifyResponse>;
  detectLanguage(request: DetectLanguageRequest): Promise<DetectLanguageResponse>;
  embed(texts: string[]): Promise<number[][]>;
  health(): Promise<HealthStatus>;
}

/** Options for the LangChain chat model factory (`src/services/llm/chatModel.ts`). */
export interface CreateChatModelOptions {
  config: AiProviderConfig;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** When set, requests JSON output (OpenAI-compatible `response_format`). */
  responseFormat?: 'json_object';
}

/** Options for the LangChain embeddings model factory (`src/services/llm/embeddingModel.ts`). */
export interface CreateEmbeddingModelOptions {
  config: AiProviderConfig;
  model?: string;
}
