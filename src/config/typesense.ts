import { env } from './env.js';

const node = Object.freeze({
  host: env.TYPESENSE_HOST,
  port: env.TYPESENSE_PORT,
  protocol: env.TYPESENSE_PROTOCOL,
});

export const typesenseConfig = Object.freeze({
  host: env.TYPESENSE_HOST,
  port: env.TYPESENSE_PORT,
  protocol: env.TYPESENSE_PROTOCOL,
  apiKey: env.TYPESENSE_API_KEY,
  collectionPrefix: env.TYPESENSE_COLLECTION_PREFIX,
  connectionTimeoutSeconds: env.TYPESENSE_CONNECTION_TIMEOUT_SECONDS,
  nodes: Object.freeze([node]),
});

export type TypesenseConfig = typeof typesenseConfig;
