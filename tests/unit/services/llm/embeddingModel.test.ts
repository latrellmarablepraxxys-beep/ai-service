import {
  beforeEach, describe, expect, it, vi 
} from 'vitest';

import { OpenAIEmbeddings } from '@langchain/openai';

import type { AiProviderConfig } from '@interfaces/aiProvider.js';
import { resolveProvider } from '@config/aiProviders.js';
import { createEmbeddingModel } from '@services/llm/EmbeddingModel.js';

vi.mock('@langchain/openai',
  () => ({
    ChatOpenAI: vi.fn(),
    OpenAIEmbeddings: vi.fn(),
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

const OpenAIEmbeddingsMock = vi.mocked(OpenAIEmbeddings);

describe('embeddingModel',
  () => {
    beforeEach(() => {
      OpenAIEmbeddingsMock.mockClear();
    });

    it('binds to the dedicated embeddings endpoint, key, model and dimensions',
      () => {
        createEmbeddingModel({ config });

        expect(OpenAIEmbeddingsMock).toHaveBeenCalledTimes(1);
        expect(OpenAIEmbeddingsMock).toHaveBeenCalledWith({
          model: 'embed-model-v1',
          apiKey: 'embed-secret',
          configuration: { baseURL: 'https://embeddings.example.com/v1' },
          dimensions: 256,
        });
      });

    it('does NOT reuse the chat baseUrl/apiKey when embeddings.* differ',
      () => {
        createEmbeddingModel({ config });

        expect(OpenAIEmbeddingsMock).toHaveBeenCalledWith({
          model: 'embed-model-v1',
          apiKey: 'embed-secret',
          configuration: { baseURL: 'https://embeddings.example.com/v1' },
          dimensions: 256,
        });
        expect(OpenAIEmbeddingsMock).not.toHaveBeenCalledWith(
          expect.objectContaining({
            apiKey: 'chat-secret',
            configuration: { baseURL: 'https://chat.example.com/v1' },
          }),
        );
      });

    it('overrides the model when provided',
      () => {
        createEmbeddingModel({
          config,
          model: 'custom-embed-model' 
        });

        expect(OpenAIEmbeddingsMock).toHaveBeenCalledWith({
          model: 'custom-embed-model',
          apiKey: 'embed-secret',
          configuration: { baseURL: 'https://embeddings.example.com/v1' },
          dimensions: 256,
        });
      });

    it('passes dimensions for providers that support it (openai, novita)',
      () => {
        createEmbeddingModel({ config: resolveProvider('openai') });
        expect(OpenAIEmbeddingsMock).toHaveBeenCalledWith(
          expect.objectContaining({ dimensions: 1024 }),
        );

        OpenAIEmbeddingsMock.mockClear();
        createEmbeddingModel({ config: resolveProvider('novita') });
        expect(OpenAIEmbeddingsMock).toHaveBeenCalledWith(
          expect.objectContaining({ dimensions: 1024 }),
        );
      });

    it('omits dimensions entirely for providers that do not support it (ollama)',
      () => {
        createEmbeddingModel({ config: resolveProvider('ollama') });

        const options = OpenAIEmbeddingsMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
        expect(options?.model).toBe('nomic-embed-text');
        expect(options).not.toHaveProperty('dimensions');
      });
  });
