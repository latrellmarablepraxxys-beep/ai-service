import pino from 'pino';

import { appConfig } from '../config/app.js';
import { loggerConfig } from '../config/logger.js';

const transport = appConfig.isDev
  ? {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }
  : {};

export const logger = pino({
  // Tests stay quiet — no pino JSON noise on the console.
  level: appConfig.isTest ? 'silent' : loggerConfig.level,
  ...transport,
});

export const childLogger = (bindings: Record<string, unknown>): pino.Logger =>
  logger.child(bindings);
