import type { ZodTypeAny } from 'zod';

import type { HealthStatus } from './cache.js';
import type { LlmProvider } from './llm.js';
import type { Persistence } from './persistence.js';

/** Probes a backing service; implementations come from each service client's `health()`. */
export type HealthProbe = () => Promise<HealthStatus>;

export type HealthState = 'ok' | 'degraded';

export interface HealthChecks {
  mongo: HealthStatus;
  redis: HealthStatus;
  typesense: HealthStatus;
  llm: HealthStatus;
}

/** Body returned by `GET /health`. */
export interface HealthResponse {
  status: HealthState;
  checks: HealthChecks;
}

/** Overrides for the rate limiter factory; unset values fall back to env-backed config. */
export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

/** Injectable metrics source so routes can be exercised without the real registry. */
export interface MetricsSnapshot {
  contentType: string;
  render: () => Promise<string>;
}

/** Overrides for the API-key middleware; unset falls back to env-backed config. */
export interface ApiKeyAuthOptions {
  keys?: readonly string[];
}

/** Symmetric counterpart to `ErrorResponse` for successful responses. */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Runtime wiring for the HTTP app. Health probes (and optionally a metrics
 * source) power the unprefixed routes; `persistence` and `llm` back the
 * versioned admin API.
 */
export interface AppDependencies {
  mongoHealth: HealthProbe;
  redisHealth: HealthProbe;
  typesenseHealth: HealthProbe;
  llmHealth: HealthProbe;
  persistence: Persistence;
  llm: LlmProvider;
  metrics?: MetricsSnapshot;
}

/** Request segment a validator reads from and writes parsed output back to. */
export type ValidationSource = 'body' | 'query' | 'params';

/** Wiring for `createValidator`: the schema to apply and the request segment to validate. */
export interface ValidatorOptions {
  schema: ZodTypeAny;
  source: ValidationSource;
}
