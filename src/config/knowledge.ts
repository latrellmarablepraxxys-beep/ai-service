import { env } from './env.js';

export const knowledgeConfig = Object.freeze({ttlSeconds: env.KNOWLEDGE_CACHE_TTL_SECONDS,});

export type KnowledgeConfig = typeof knowledgeConfig;
