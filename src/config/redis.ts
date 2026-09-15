import { appConfig } from './app.js';
import { env } from './env.js';

export const redisConfig = Object.freeze({
  url: env.REDIS_URL,
  commandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
  queuePrefix: `${appConfig.name}:queue:`,
});

export type RedisConfig = typeof redisConfig;
