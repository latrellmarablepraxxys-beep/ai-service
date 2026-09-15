import type { Redis } from 'ioredis';

import type { HealthStatus } from './cache.js';

export interface RedisConnection {
  connect(): Promise<void>;
  getClient(): Redis;
  close(): Promise<void>;
  health(): Promise<HealthStatus>;
}

export type RedisProfile = 'queue' | 'cache';

export interface CreateRedisConnectionOptions {
  url?: string;
  profile?: RedisProfile;
  client?: Redis;
}

export interface CreateRedisCacheClientOptions {
  client: Redis;
  namespace?: string;
}
