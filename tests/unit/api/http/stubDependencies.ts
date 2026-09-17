import { fakeAiProviderConfig } from '@fakes/fakeAiProviderConfig.js';
import { FakeCacheClient } from '@fakes/fakeCacheClient.js';
import { FakeLlmProvider } from '@fakes/fakeLlmProvider.js';
import { FakePersistence } from '@fakes/fakePersistence.js';
import type { HealthStatus } from '@interfaces/cache.js';
import type { AppDependencies, HealthProbe } from '@interfaces/http.js';

/** A connected-by-default health status; pass overrides to simulate a degraded probe. */
export const healthStatus = (overrides: Partial<HealthStatus> = {}): HealthStatus => ({
  connected: true,
  latencyMs: 1,
  ...overrides,
});

export const stubProbe = (result: HealthStatus): HealthProbe => {
  return () => Promise.resolve(result);
};

/** All-healthy dependency set; override individual probes for failure cases. */
export const stubDependencies = (overrides: Partial<AppDependencies> = {}): AppDependencies => ({
  mongoHealth: stubProbe(healthStatus()),
  redisHealth: stubProbe(healthStatus()),
  typesenseHealth: stubProbe(healthStatus()),
  llmHealth: stubProbe(healthStatus()),
  persistence: new FakePersistence(),
  llm: new FakeLlmProvider({ config: fakeAiProviderConfig }),
  cache: new FakeCacheClient(),
  ...overrides,
});
