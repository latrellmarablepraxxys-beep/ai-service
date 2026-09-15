import type {
  AiModels,
  AiProvider,
  AiProviderConfig,
  AiProviderOverrides,
} from '../interfaces/aiProvider.js';
import { env } from './env.js';

export const providerPresets = {
  openai: {
    driver: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    models: {
      chat: 'gpt-4o-mini',
      classifier: 'gpt-4o-mini',
      embedding: 'text-embedding-3-small',
    },
    embeddingSupportsDimensions: true,
  },
  ollama: {
    driver: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    models: {
      chat: 'llama3.2',
      classifier: 'llama3.2',
      embedding: 'nomic-embed-text',
    },
    embeddingSupportsDimensions: false,
  },
  novita: {
    driver: 'openai',
    baseUrl: 'https://api.novita.ai/v3/openai',
    apiKey: '',
    models: {
      chat: 'deepseek/deepseek-v3',
      classifier: 'deepseek/deepseek-v3',
      embedding: 'openai/text-embedding-3-small',
    },
    embeddingSupportsDimensions: true,
  },
} as const satisfies Record<
  AiProvider,
  {
    driver: string;
    baseUrl: string;
    apiKey: string;
    models: AiModels;
    embeddingSupportsDimensions: boolean;
  }
>;

export function resolveProvider(
  provider: AiProvider,
  overrides: AiProviderOverrides = {},
): AiProviderConfig {
  const preset = providerPresets[provider];

  const baseUrl = overrides.baseUrl || preset.baseUrl;
  const apiKey = overrides.apiKey || preset.apiKey;

  return Object.freeze({
    provider,
    driver: preset.driver,
    baseUrl,
    apiKey,
    models: Object.freeze({
      chat: overrides.chat || preset.models.chat,
      classifier: overrides.classifier || preset.models.classifier,
      embedding: overrides.embedding || preset.models.embedding,
    }),
    embeddings: Object.freeze({
      baseUrl: overrides.embeddingBaseUrl || baseUrl,
      apiKey: overrides.embeddingApiKey || apiKey,
      dimensions: overrides.embeddingDimensions ?? 1024,
      supportsDimensions:
        overrides.embeddingSupportsDimensions ?? preset.embeddingSupportsDimensions,
    }),
  });
}

const envOverridesByProvider = Object.freeze({
  openai: Object.freeze({
    baseUrl: env.OPENAI_BASE_URL,
    apiKey: env.OPENAI_API_KEY,
    chat: env.OPENAI_CHAT_MODEL,
    classifier: env.OPENAI_CLASSIFIER_MODEL,
    embedding: env.OPENAI_EMBEDDING_MODEL,
  }),
  ollama: Object.freeze({
    baseUrl: env.OLLAMA_BASE_URL,
    apiKey: env.OLLAMA_API_KEY,
    chat: env.OLLAMA_CHAT_MODEL,
    classifier: env.OLLAMA_CLASSIFIER_MODEL,
    embedding: env.OLLAMA_EMBEDDING_MODEL,
  }),
  novita: Object.freeze({
    baseUrl: env.NOVITA_BASE_URL,
    apiKey: env.NOVITA_API_KEY,
    chat: env.NOVITA_CHAT_MODEL,
    classifier: env.NOVITA_CLASSIFIER_MODEL,
    embedding: env.NOVITA_EMBEDDING_MODEL,
  }),
} satisfies Record<AiProvider, AiProviderOverrides>);

/**
 * Embeddings are configured per *slot*, not per provider: a deployment can chat
 * via Novita while embedding through a separate OpenAI-compatible proxy. These
 * overrides apply to whichever provider is active. Empty values fall back to the
 * provider's own baseUrl/apiKey.
 *
 * NOTE: `embeddingSupportsDimensions` is deliberately NOT set here — it is a
 * preset capability, not an env knob. The preset default stands unless an
 * explicit override is passed to `resolveProvider`.
 */
const embeddingOverrides: AiProviderOverrides = Object.freeze({
  ...(env.EMBEDDING_BASE_URL ? { embeddingBaseUrl: env.EMBEDDING_BASE_URL } : {}),
  ...(env.EMBEDDING_API_KEY ? { embeddingApiKey: env.EMBEDDING_API_KEY } : {}),
  ...(env.EMBEDDING_MODEL ? { embedding: env.EMBEDDING_MODEL } : {}),
  embeddingDimensions: env.EMBEDDING_DIMENSIONS,
});

const buildProviders = (): Record<AiProvider, AiProviderConfig> =>
  Object.fromEntries(
    (Object.keys(providerPresets) as AiProvider[]).map((provider) => [
      provider,
      resolveProvider(provider, {
        ...envOverridesByProvider[provider],
        ...embeddingOverrides,
      }),
    ]),
  ) as Record<AiProvider, AiProviderConfig>;

export const aiConfig = Object.freeze({
  default: env.AI_PROVIDER,
  providers: Object.freeze(buildProviders()),
});

export const aiProvider: AiProviderConfig = aiConfig.providers[aiConfig.default];

export type AiConfig = typeof aiConfig;
