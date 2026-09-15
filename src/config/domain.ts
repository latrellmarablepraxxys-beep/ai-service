import { env } from './env.js';

export const domainConfig = Object.freeze({
  baseUrl: env.DOMAIN_API_URL,
  apiKey: env.DOMAIN_API_KEY,
  timeoutMs: env.DOMAIN_API_TIMEOUT_MS,
});

export type DomainConfig = typeof domainConfig;
