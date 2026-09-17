import type { AiProviderConfig } from '@interfaces/aiProvider.js';
import type { HealthStatus } from '@interfaces/cache.js';
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ClassifyRequest,
  ClassifyResponse,
  DetectLanguageRequest,
  DetectLanguageResponse,
  LlmProvider,
  TokenUsage,
} from '@interfaces/llm.js';

type ChatStreamGenerator = AsyncGenerator<ChatStreamChunk, void, unknown>;

export interface FakeLlmProviderOptions {
  config: AiProviderConfig;
  chatResponse?: Partial<ChatResponse>;
  streamChunks?: string[];
  classifyResult?: ClassifyResponse;
  detectLanguageResult?: DetectLanguageResponse;
}

const DEFAULT_USAGE: TokenUsage = {
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15 
};

/** FNV-1a — deterministic 32-bit hash, stable across runs and platforms. */
const hashString = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Deterministic vector in [-1, 1) derived from the input text + configured dimensions. */
const embedOne = (text: string, dimensions: number): number[] => {
  const seed = hashString(text);
  const vector: number[] = [];
  for (let i = 0; i < dimensions; i += 1) {
    const unit = hashString(`${seed}:${i}`) / 0xffffffff; // [0, 1)
    vector.push(unit * 2 - 1); // [-1, 1)
  }
  return vector;
};

/**
 * Deterministic in-memory LlmProvider for unit/E2E tests. Never touches the
 * network: canned chat response, fixed streamed chunks, preset classify result,
 * and embedding vectors derived from a hash of each input.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly config: AiProviderConfig;
  private readonly chatResponse: ChatResponse;
  private readonly streamChunks: string[];
  private readonly classifyResult: ClassifyResponse;
  private readonly detectLanguageResult: DetectLanguageResponse;

  constructor(options: FakeLlmProviderOptions) {
    this.config = options.config;
    this.chatResponse = {
      content: 'fake assistant reply',
      model: options.config.models.chat,
      finishReason: 'stop',
      usage: DEFAULT_USAGE,
      ...options.chatResponse,
    };
    this.streamChunks = options.streamChunks ?? [
      'fake ',
      'assistant ',
      'reply'
    ];
    this.classifyResult = options.classifyResult ?? {
      route: 'ai',
      confidence: 0.9,
      reasoning: 'fake classification',
    };
    this.detectLanguageResult = options.detectLanguageResult ?? {
      language: 'Tagalog',
      confidence: 0.9,
    };
  }

  chat(request: ChatRequest): Promise<ChatResponse> {
    return Promise.resolve({
      ...this.chatResponse,
      model: request.model ?? this.chatResponse.model,
    });
  }

  async *chatStream(_request: ChatRequest): ChatStreamGenerator {
    // Yield on a microtask boundary so the generator is a real async iterable.
    await Promise.resolve();
    for (const chunk of this.streamChunks) {
      yield {
        type: 'delta',
        content: chunk 
      };
    }
    yield {
      type: 'done',
      finishReason: this.chatResponse.finishReason,
      usage: this.chatResponse.usage,
    };
  }

  classify(_request: ClassifyRequest): Promise<ClassifyResponse> {
    return Promise.resolve(this.classifyResult);
  }

  detectLanguage(_request: DetectLanguageRequest): Promise<DetectLanguageResponse> {
    return Promise.resolve(this.detectLanguageResult);
  }

  embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return Promise.resolve([]);
    return Promise.resolve(texts.map((text) => embedOne(text, this.config.embeddings.dimensions)));
  }

  /** Deterministic healthy probe — no network, fixed zero latency. */
  health(): Promise<HealthStatus> {
    return Promise.resolve({
      connected: true,
      latencyMs: 0 
    });
  }
}
