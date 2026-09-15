import {
  beforeEach, describe, expect, it, vi 
} from 'vitest';

import { ChatOpenAI } from '@langchain/openai';

import type { AiProviderConfig } from '@interfaces/aiProvider.js';
import { createChatModel } from '@services/llm/ChatModel.js';

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

const ChatOpenAIMock = vi.mocked(ChatOpenAI);

describe('chatModel',
  () => {
    beforeEach(() => {
      ChatOpenAIMock.mockClear();
    });

    it('binds the chat connection to config.models.chat and the provider endpoint',
      () => {
        createChatModel({ config });

        expect(ChatOpenAIMock).toHaveBeenCalledTimes(1);
        expect(ChatOpenAIMock).toHaveBeenCalledWith({
          model: 'chat-model-v1',
          apiKey: 'chat-secret',
          configuration: { baseURL: 'https://chat.example.com/v1' },
        });
      });

    it('overrides the model, temperature and maxTokens when provided',
      () => {
        createChatModel({
          config,
          model: 'other-model',
          temperature: 0.3,
          maxTokens: 42 
        });

        expect(ChatOpenAIMock).toHaveBeenCalledWith({
          model: 'other-model',
          apiKey: 'chat-secret',
          configuration: { baseURL: 'https://chat.example.com/v1' },
          temperature: 0.3,
          maxTokens: 42,
        });
      });

    it('omits temperature and maxTokens when not provided',
      () => {
        createChatModel({
          config,
          model: 'other-model' 
        });

        expect(ChatOpenAIMock).toHaveBeenCalledWith({
          model: 'other-model',
          apiKey: 'chat-secret',
          configuration: { baseURL: 'https://chat.example.com/v1' },
        });
      });
  });
