import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test' && process.env.VITEST === undefined) {
  dotenv.config();
}

const isBlank = (value: string): boolean => value.trim().length === 0;

const schema = z
  .object({
    NODE_ENV: z.enum([
      'development',
      'test',
      'production'
    ]).default('development'),

    PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.union([
      z.literal(''),
      z.string().url()
    ]).default(''),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    // Express `trust proxy` setting: '' (disabled), 'true'/'false', or a hop count.
    TRUST_PROXY: z.string().default(''),

    DOMAIN_API_URL: z.string().url().default('http://localhost:8000/api'),
    DOMAIN_API_KEY: z.string().default(''),
    DOMAIN_API_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

    // Comma-separated API keys the admin app presents as `X-Api-Key`.
    AI_API_KEYS: z.string().default(''),

    AI_PROVIDER: z.enum([
      'openai',
      'ollama',
      'novita'
    ]).default('openai'),

    OPENAI_BASE_URL: z.union([
      z.literal(''),
      z.string().url()
    ]).default(''),
    OPENAI_API_KEY: z.string().default(''),
    OPENAI_CHAT_MODEL: z.string().default(''),
    OPENAI_CLASSIFIER_MODEL: z.string().default(''),
    OPENAI_EMBEDDING_MODEL: z.string().default(''),

    OLLAMA_BASE_URL: z.union([
      z.literal(''),
      z.string().url()
    ]).default(''),
    OLLAMA_API_KEY: z.string().default(''),
    OLLAMA_CHAT_MODEL: z.string().default(''),
    OLLAMA_CLASSIFIER_MODEL: z.string().default(''),
    OLLAMA_EMBEDDING_MODEL: z.string().default(''),

    NOVITA_BASE_URL: z.union([
      z.literal(''),
      z.string().url()
    ]).default(''),
    NOVITA_API_KEY: z.string().default(''),
    NOVITA_CHAT_MODEL: z.string().default(''),
    NOVITA_CLASSIFIER_MODEL: z.string().default(''),
    NOVITA_EMBEDDING_MODEL: z.string().default(''),

    EMBEDDING_BASE_URL: z.union([
      z.literal(''),
      z.string().url()
    ]).default(''),
    EMBEDDING_API_KEY: z.string().default(''),
    EMBEDDING_MODEL: z.string().default(''),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1024),

    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/motorcentral-omnichannel-ai'),
    MONGODB_DB: z.string().min(1).default('motorcentral-omnichannel-ai'),

    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),

    TYPESENSE_HOST: z.string().min(1).default('localhost'),
    TYPESENSE_PORT: z.coerce.number().int().positive().default(8108),
    TYPESENSE_PROTOCOL: z.enum([
      'http',
      'https'
    ]).default('http'),
    TYPESENSE_API_KEY: z.string().default(''),
    TYPESENSE_COLLECTION_PREFIX: z.string().default('ai_'),
    TYPESENSE_CONNECTION_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(5),

    WEBHOOK_VERIFY_TOKEN: z.string().default(''),
    WEBHOOK_SIGNING_SECRET: z.string().default(''),

    // Dev tooling: mock of the Laravel admin's /api/v1 (see scripts/mockAdminApi.ts).
    MOCK_ADMIN_API_PORT: z.coerce.number().int().positive().default(8000),

    LOG_LEVEL: z
      .enum([
        'fatal',
        'error',
        'warn',
        'info',
        'debug',
        'trace',
        'silent'
      ])
      .default('info'),
    LOG_DIR: z.string().min(1).default('./logs'),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV !== 'production') return;

    if (values.AI_PROVIDER !== 'ollama') {
      const providerApiKeyEnv = {
        openai: 'OPENAI_API_KEY',
        ollama: 'OLLAMA_API_KEY',
        novita: 'NOVITA_API_KEY',
      } as const;

      const requiredKey = providerApiKeyEnv[values.AI_PROVIDER];
      if (isBlank(values[requiredKey])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [requiredKey],
          message: `${requiredKey} is required in production when AI_PROVIDER is ${values.AI_PROVIDER}`,
        });
      }
    }

    // WEBHOOK_VERIFY_TOKEN / WEBHOOK_SIGNING_SECRET are intentionally excluded:
    // the webhook route is not implemented yet, so requiring them would fail a
    // production boot on unused vars. Move them here once the webhook route lands.
    const requiredInProduction = {
      DOMAIN_API_KEY: values.DOMAIN_API_KEY,
      TYPESENSE_API_KEY: values.TYPESENSE_API_KEY,
      AI_API_KEYS: values.AI_API_KEYS,
    } as const;

    for (const [
      key,
      value
    ] of Object.entries(requiredInProduction)) {
      if (isBlank(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

const formatIssues = (issues: z.ZodIssue[]): string =>
  issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(result.error.issues)}`);
  }
  return Object.freeze(result.data);
};

export const env: Env = loadEnv();
