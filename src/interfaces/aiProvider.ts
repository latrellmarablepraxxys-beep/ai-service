export type AiProvider = 'openai' | 'ollama' | 'novita';

export interface AiModels {
  chat: string;
  classifier: string;
  embedding: string;
}

export interface AiEmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  dimensions: number;
  /**
   * Whether the provider accepts a `dimensions` hint on embedding requests.
   * Preset capability, not env-driven: providers like ollama (nomic-embed-text,
   * fixed 768-dim) must never receive a dimensions hint they don't support.
   */
  supportsDimensions: boolean;
}

export interface AiProviderConfig {
  provider: AiProvider;
  driver: string;
  baseUrl: string;
  apiKey: string;
  models: AiModels;
  embeddings: AiEmbeddingConfig;
}

export type AiProviderOverrides = Partial<
  AiModels & {
    baseUrl: string;
    apiKey: string;
    embeddingBaseUrl: string;
    embeddingApiKey: string;
    embeddingDimensions: number;
    /**
     * Explicit preset-capability override for `AiEmbeddingConfig.supportsDimensions`.
     * Not env-driven — an operator may pin it if they know their proxy/model supports
     * (or rejects) a dimensions hint regardless of the base preset.
     */
    embeddingSupportsDimensions: boolean;
  }
>;
