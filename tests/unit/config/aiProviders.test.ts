import {
  describe, expect, it 
} from 'vitest';

import {
  aiConfig,
  aiProvider,
  providerPresets,
  resolveProvider,
} from '@config/aiProviders.js';
import type { AiProvider } from '@interfaces/aiProvider.js';

describe('aiProviders',
  () => {
    it('has presets for every supported provider',
      () => {
        for (const provider of [
          'openai',
          'ollama',
          'novita'
        ]) {
          expect(providerPresets[provider as AiProvider]).toBeDefined();
        }
      });

    it('resolves the embeddings slot to the provider connection by default',
      () => {
        const openai = resolveProvider('openai');
        expect(openai.embeddings.baseUrl).toBe('https://api.openai.com/v1');
        expect(openai.embeddings.apiKey).toBe(openai.apiKey);
        expect(openai.embeddings.dimensions).toBe(1024);
      });

    it('marks embedding dimensions support per provider preset',
      () => {
        expect(resolveProvider('openai').embeddings.supportsDimensions).toBe(true);
        expect(resolveProvider('novita').embeddings.supportsDimensions).toBe(true);
        expect(resolveProvider('ollama').embeddings.supportsDimensions).toBe(false);
      });

    it('allows an explicit embeddingSupportsDimensions override',
      () => {
        const openai = resolveProvider('openai', { embeddingSupportsDimensions: false });
        expect(openai.embeddings.supportsDimensions).toBe(false);

        const ollama = resolveProvider('ollama', { embeddingSupportsDimensions: true });
        expect(ollama.embeddings.supportsDimensions).toBe(true);
      });

    it('supports a dedicated embeddings endpoint separate from chat',
      () => {
        const config = resolveProvider('novita',
          {
            baseUrl: 'https://api.novita.ai/openai',
            apiKey: 'novita-key',
            embeddingBaseUrl: 'https://prod-ai-proxy.example.dev/code',
            embeddingApiKey: 'proxy-key',
            embedding: 'ext-embedding-3-small',
            embeddingDimensions: 1024,
          });

        expect(config.baseUrl).toBe('https://api.novita.ai/openai');
        expect(config.apiKey).toBe('novita-key');
        expect(config.models.embedding).toBe('ext-embedding-3-small');
        expect(config.embeddings.baseUrl).toBe('https://prod-ai-proxy.example.dev/code');
        expect(config.embeddings.apiKey).toBe('proxy-key');
        expect(config.embeddings.dimensions).toBe(1024);
      });

    it('resolves the provider preset when no overrides are given',
      () => {
        const openai = resolveProvider('openai');
        expect(openai.baseUrl).toBe('https://api.openai.com/v1');
        expect(openai.models.chat).toBe('gpt-4o-mini');
        expect(openai.models.embedding).toBe('text-embedding-3-small');

        const ollama = resolveProvider('ollama');
        expect(ollama.baseUrl).toBe('http://localhost:11434/v1');
        expect(ollama.apiKey).toBe('ollama');
        expect(ollama.models.chat).toBe('llama3.2');

        const novita = resolveProvider('novita');
        expect(novita.baseUrl).toBe('https://api.novita.ai/v3/openai');
        expect(novita.models.chat).toBe('deepseek/deepseek-v3');
      });

    it('applies env overrides on top of the preset',
      () => {
        const config = resolveProvider('openai',
          {
            baseUrl: 'https://proxy.example.com/v1',
            apiKey: 'proxy-key',
            chat: 'custom-chat',
          });

        expect(config.baseUrl).toBe('https://proxy.example.com/v1');
        expect(config.apiKey).toBe('proxy-key');
        expect(config.models.chat).toBe('custom-chat');
        expect(config.models.classifier).toBe('gpt-4o-mini');
        expect(config.models.embedding).toBe('text-embedding-3-small');
      });

    it('builds the active provider from what the environment selects',
      () => {
        expect(aiProvider.provider).toBe(aiConfig.default);
        expect(aiConfig.providers[aiProvider.provider]).toBe(aiProvider);
        expect(Object.keys(aiConfig.providers)).toHaveLength(3);
      });
  });
