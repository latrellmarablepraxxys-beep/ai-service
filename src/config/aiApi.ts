import { env } from './env.js';

const parseApiKeys = (raw: string): readonly string[] =>
  raw
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

export const aiApiConfig = Object.freeze({apiKeys: parseApiKeys(env.AI_API_KEYS),});

export type AiApiConfig = typeof aiApiConfig;
