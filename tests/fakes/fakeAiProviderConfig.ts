import type { AiProviderConfig } from '@interfaces/aiProvider.js';

/** Deterministic provider config for tests — no real endpoints or secrets. */
export const fakeAiProviderConfig: AiProviderConfig = {
  provider: 'openai',
  driver: 'openai',
  baseUrl: 'https://chat.example.com/v1',
  apiKey: 'test-chat-secret',
  models: {
    chat: 'chat-model-v1',
    classifier: 'classifier-model-v1',
    embedding: 'embed-model-v1',
  },
  embeddings: {
    baseUrl: 'https://embeddings.example.com/v1',
    apiKey: 'test-embed-secret',
    dimensions: 256,
    supportsDimensions: true,
  },
};
