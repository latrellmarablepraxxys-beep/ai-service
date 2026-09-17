import { env } from './env.js';

/**
 * Mock admin API (dev tooling) — mirrors the Laravel admin's `/api/v1` so the
 * service can be developed and tested without the real admin running. The key
 * is the same one this service sends outbound (`DOMAIN_API_KEY`).
 */
export const mockAdminApiConfig = Object.freeze({
  port: env.MOCK_ADMIN_API_PORT,
  apiKey: env.DOMAIN_API_KEY,
});

export type MockAdminApiConfig = typeof mockAdminApiConfig;
