import { env } from './env.js';

export const loggerConfig = Object.freeze({
  level: env.LOG_LEVEL,
  dir: env.LOG_DIR,
});

export type LoggerConfig = typeof loggerConfig;
