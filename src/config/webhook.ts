import { env } from './env.js';

export const webhookConfig = Object.freeze({
  verifyToken: env.WEBHOOK_VERIFY_TOKEN,
  signingSecret: env.WEBHOOK_SIGNING_SECRET,
});

export type WebhookConfig = typeof webhookConfig;
