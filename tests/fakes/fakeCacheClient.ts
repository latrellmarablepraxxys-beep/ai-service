import type { CacheClient, HealthStatus } from '@interfaces/cache.js';

/** In-memory `CacheClient` for tests — Map-backed, no Redis. TTLs are accepted but not enforced. */
export class FakeCacheClient implements CacheClient {
  private readonly store = new Map<string, unknown>();

  get<T>(key: string): Promise<T | null> {
    const value = this.store.get(key);
    if (value === undefined || value === null) return Promise.resolve(null);
    return Promise.resolve(value as T);
  }

  set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  withTtl<T>(key: string, value: T, _ttlSeconds: number): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  has(key: string): Promise<boolean> {
    return Promise.resolve(this.store.has(key));
  }

  health(): Promise<HealthStatus> {
    return Promise.resolve({
      connected: true,
      latencyMs: 0 
    });
  }
}
