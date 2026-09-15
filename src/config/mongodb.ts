import { env } from './env.js';

export const mongodbConfig = Object.freeze({
  uri: env.MONGODB_URI,
  dbName: env.MONGODB_DB,
});

export type MongodbConfig = typeof mongodbConfig;
