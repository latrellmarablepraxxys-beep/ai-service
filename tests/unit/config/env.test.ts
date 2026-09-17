import {
  describe, expect, it 
} from 'vitest';

import { loadEnv } from '@config/env.js';

describe('loadEnv',
  () => {
    it('applies safe defaults in development',
      () => {
        const env = loadEnv({ NODE_ENV: 'development' });

        expect(env.PORT).toBe(3001);
        expect(env.TRUST_PROXY).toBe('');
        expect(env.AI_PROVIDER).toBe('openai');
        expect(env.OPENAI_BASE_URL).toBe('');
        expect(env.NOVITA_CHAT_MODEL).toBe('');
        expect(env.EMBEDDING_BASE_URL).toBe('');
        expect(env.EMBEDDING_DIMENSIONS).toBe(1024);
        expect(env.MONGODB_DB).toBe('motorcentral-omnichannel-ai');
        expect(env.TYPESENSE_PORT).toBe(8108);
        expect(env.TYPESENSE_CONNECTION_TIMEOUT_SECONDS).toBe(5);
        expect(env.REDIS_COMMAND_TIMEOUT_MS).toBe(2000);
        expect(env.RATE_LIMIT_WINDOW_MS).toBe(60_000);
        expect(env.AI_API_KEYS).toBe('');
        expect(env.MOCK_ADMIN_API_PORT).toBe(8000);
        expect(env.KNOWLEDGE_CACHE_TTL_SECONDS).toBe(300);
        expect(env.DOMAIN_API_URL).toBe('http://localhost:8000/api/v1');
      });

    it('coerces numeric strings',
      () => {
        const env = loadEnv({
          NODE_ENV: 'test',
          PORT: '4000',
          TYPESENSE_PORT: '9108',
          TYPESENSE_CONNECTION_TIMEOUT_SECONDS: '7',
          REDIS_COMMAND_TIMEOUT_MS: '1500',
          RATE_LIMIT_MAX: '250',
        });

        expect(env.PORT).toBe(4000);
        expect(env.TYPESENSE_PORT).toBe(9108);
        expect(env.TYPESENSE_CONNECTION_TIMEOUT_SECONDS).toBe(7);
        expect(env.REDIS_COMMAND_TIMEOUT_MS).toBe(1500);
        expect(env.RATE_LIMIT_MAX).toBe(250);
        expect(env.KNOWLEDGE_CACHE_TTL_SECONDS).toBe(300);

        const overridden = loadEnv({
          NODE_ENV: 'test',
          KNOWLEDGE_CACHE_TTL_SECONDS: '600',
        });

        expect(overridden.KNOWLEDGE_CACHE_TTL_SECONDS).toBe(600);
      });

    it('overrides values from the source',
      () => {
        const env = loadEnv({
          NODE_ENV: 'development',
          AI_PROVIDER: 'openai',
          OPENAI_CHAT_MODEL: 'custom-model',
        });

        expect(env.OPENAI_CHAT_MODEL).toBe('custom-model');
      });

    it('requires secrets in production',
      () => {
        expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/OPENAI_API_KEY/);
      });

    it("requires the active provider's secret in production",
      () => {
        expect(() => loadEnv({
          NODE_ENV: 'production',
          AI_PROVIDER: 'novita' 
        })).toThrow(/NOVITA_API_KEY/);
      });

    it('exempts ollama from the production key requirement',
      () => {
        const env = loadEnv({
          NODE_ENV: 'production',
          AI_PROVIDER: 'ollama',
          DOMAIN_API_KEY: 'domain-key',
          TYPESENSE_API_KEY: 'typesense-key',
          AI_API_KEYS: 'ai-key',
        });

        expect(env.AI_PROVIDER).toBe('ollama');
      });

    it('passes in production without the (unused) webhook secrets',
      () => {
        const env = loadEnv({
          NODE_ENV: 'production',
          OPENAI_API_KEY: 'ai-key',
          DOMAIN_API_KEY: 'domain-key',
          TYPESENSE_API_KEY: 'typesense-key',
          AI_API_KEYS: 'admin-key',
        });

        expect(env.NODE_ENV).toBe('production');
        expect(env.WEBHOOK_VERIFY_TOKEN).toBe('');
        expect(env.WEBHOOK_SIGNING_SECRET).toBe('');
      });

    it('requires the remaining production secrets when blank',
      () => {
        expect(() =>
          loadEnv({
            NODE_ENV: 'production',
            OPENAI_API_KEY: 'ai-key',
            DOMAIN_API_KEY: '   ',
            TYPESENSE_API_KEY: 'typesense-key',
            AI_API_KEYS: 'admin-key',
          }),
        ).toThrow(/DOMAIN_API_KEY/);

        expect(() =>
          loadEnv({
            NODE_ENV: 'production',
            OPENAI_API_KEY: 'ai-key',
            DOMAIN_API_KEY: 'domain-key',
            TYPESENSE_API_KEY: '   ',
            AI_API_KEYS: 'admin-key',
          }),
        ).toThrow(/TYPESENSE_API_KEY/);

        expect(() =>
          loadEnv({
            NODE_ENV: 'production',
            OPENAI_API_KEY: 'ai-key',
            DOMAIN_API_KEY: 'domain-key',
            TYPESENSE_API_KEY: 'typesense-key',
            AI_API_KEYS: '   ',
          }),
        ).toThrow(/AI_API_KEYS/);

        expect(() =>
          loadEnv({
            NODE_ENV: 'production',
            AI_PROVIDER: 'novita',
            DOMAIN_API_KEY: 'domain-key',
            TYPESENSE_API_KEY: 'typesense-key',
            AI_API_KEYS: 'admin-key',
          }),
        ).toThrow(/NOVITA_API_KEY/);
      });

    it('rejects a non-numeric port',
      () => {
        expect(() => loadEnv({
          NODE_ENV: 'development',
          PORT: 'not-a-number' 
        })).toThrow(/PORT/);
      });

    it('rejects an invalid URL',
      () => {
        expect(() => loadEnv({
          NODE_ENV: 'development',
          FRONTEND_URL: 'not-a-url' 
        })).toThrow(/FRONTEND_URL/);
      });

    it('rejects an unknown AI provider',
      () => {
        expect(() => loadEnv({
          NODE_ENV: 'development',
          AI_PROVIDER: 'anthropic' 
        })).toThrow(/AI_PROVIDER/);
      });
  });
