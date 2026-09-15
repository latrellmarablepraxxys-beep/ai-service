import { OpenAIEmbeddings } from '@langchain/openai';

import type { CreateEmbeddingModelOptions } from '../../interfaces/llm.js';

/**
 * Builds the LangChain embeddings model bound to the *dedicated* embeddings
 * endpoint (`config.embeddings.*`), which may differ from the chat connection.
 *
 * Verified against the installed types (@langchain/openai 0.3.17):
 * `OpenAIEmbeddingsParams` exposes `dimensions?: number`, so it is passed
 * through from config.
 *
 * `dimensions` is only sent when the provider explicitly supports it
 * (`config.embeddings.supportsDimensions`). Providers like ollama
 * (nomic-embed-text, fixed 768-dim) reject or silently mismatch a dimensions
 * hint, so the option is omitted entirely for them — never passed as
 * `undefined`. `config.embeddings.dimensions` remains the declared vector size
 * for the Typesense field regardless.
 */
export const createEmbeddingModel = (options: CreateEmbeddingModelOptions): OpenAIEmbeddings =>
  new OpenAIEmbeddings({
    model: options.model ?? options.config.models.embedding,
    apiKey: options.config.embeddings.apiKey,
    configuration: { baseURL: options.config.embeddings.baseUrl },
    ...(options.config.embeddings.supportsDimensions
      ? { dimensions: options.config.embeddings.dimensions }
      : {}),
  });
