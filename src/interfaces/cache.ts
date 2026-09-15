export type CacheErrorCode = 'CACHE_ERROR' | 'CACHE_CONNECTION_ERROR' | 'CACHE_TIMEOUT';

export interface HealthStatus {
  connected: boolean;
  latencyMs: number | undefined;
}

export interface CacheClient {
  /**
   * Values are JSON-serialized by the adapter on write and deserialized on read. A cache miss and
   * a cached `null`/`undefined` are indistinguishable — both surface as `null`.
   */
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  withTtl<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  health(): Promise<HealthStatus>;
}
