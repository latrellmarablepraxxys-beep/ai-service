import {
  describe, expect, it 
} from 'vitest';

import type { AiProviderConfig } from '@interfaces/aiProvider.js';
import type { ChatStreamChunk } from '@interfaces/llm.js';
import { FakeLlmProvider } from './fakeLlmProvider.js';

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

describe('FakeLlmProvider',
  () => {
    it('returns the canned chat response, defaulting the model from config',
      async () => {
        const fake = new FakeLlmProvider({ config });

        await expect(fake.chat({
          messages: [
            {
              role: 'user',
              content: 'hi' 
            }
          ] 
        })).resolves.toEqual({
          content: 'fake assistant reply',
          model: 'chat-model-v1',
          finishReason: 'stop',
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15 
          },
        });
      });

    it('honours a per-request model override in chat',
      async () => {
        const fake = new FakeLlmProvider({ config });

        const response = await fake.chat({
          messages: [],
          model: 'other-model' 
        });

        expect(response.model).toBe('other-model');
      });

    it('streams fixed chunks then a done chunk',
      async () => {
        const fake = new FakeLlmProvider({
          config,
          streamChunks: [
            'one',
            'two'
          ] 
        });

        const chunks: ChatStreamChunk[] = [];
        for await (const chunk of fake.chatStream({ messages: [] })) {
          chunks.push(chunk);
        }

        expect(chunks).toEqual([
          {
            type: 'delta',
            content: 'one' 
          },
          {
            type: 'delta',
            content: 'two' 
          },
          {
            type: 'done',
            finishReason: 'stop',
            usage: {
              promptTokens: 10,
              completionTokens: 5,
              totalTokens: 15 
            },
          },
        ]);
      });

    it('classifies to the preset route',
      async () => {
        const fake = new FakeLlmProvider({ config });

        await expect(fake.classify({ text: 'route me' })).resolves.toEqual({
          route: 'ai',
          confidence: 0.9,
          reasoning: 'fake classification',
        });
      });

    it('accepts a custom classify result',
      async () => {
        const fake = new FakeLlmProvider({
          config,
          classifyResult: {
            route: 'agent',
            confidence: 0.4,
            reasoning: undefined 
          },
        });

        await expect(fake.classify({ text: 'route me' })).resolves.toEqual({
          route: 'agent',
          confidence: 0.4,
          reasoning: undefined,
        });
      });

    it('embeds deterministically — same input, same vector, across calls',
      async () => {
        const fake = new FakeLlmProvider({ config });

        const first = await fake.embed(['same text']);
        const second = await fake.embed(['same text']);

        expect(first).toEqual(second);
        expect(first[0]).toHaveLength(256);
      });

    it('embeds different inputs to different vectors',
      async () => {
        const fake = new FakeLlmProvider({ config });

        const [
          a,
          b
        ] = await fake.embed([
          'first text',
          'second text'
        ]);

        expect(a).not.toEqual(b);
      });

    it('respects the configured embedding dimensions',
      async () => {
        const fake = new FakeLlmProvider({
          config: {
            ...config,
            embeddings: {
              ...config.embeddings,
              dimensions: 8 
            } 
          },
        });

        const vectors = await fake.embed([
          'x',
          'y'
        ]);

        expect(vectors).toHaveLength(2);
        expect(vectors[0]).toHaveLength(8);
        expect(vectors[1]).toHaveLength(8);
      });

    it('short-circuits empty input to an empty result',
      async () => {
        const fake = new FakeLlmProvider({ config });

        await expect(fake.embed([])).resolves.toEqual([]);
      });
  });
