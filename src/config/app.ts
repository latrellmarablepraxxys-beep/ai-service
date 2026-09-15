import { env } from './env.js';

const nodeEnv = env.NODE_ENV;

export const appConfig = Object.freeze({
  name: 'motorcentral-omnichannel-ai',
  env: nodeEnv,
  port: env.PORT,
  baseUrl: env.APP_URL || `http://localhost:${env.PORT}`,
  frontendUrl: env.FRONTEND_URL,
  trustProxy: env.TRUST_PROXY,
  isDev: nodeEnv === 'development',
  isTest: nodeEnv === 'test',
  isProd: nodeEnv === 'production',
});

export type AppConfig = typeof appConfig;
