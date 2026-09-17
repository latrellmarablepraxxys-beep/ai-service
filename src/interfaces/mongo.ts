import type { Db, MongoClient } from 'mongodb';

import type { HealthStatus } from './persistence.js';

/**
 * Collection names this service owns. The values themselves live in
 * `src/persistence/models/Collections.ts` (single source of truth, guarded with
 * a `satisfies` check against this union).
 */
export type CollectionName = 'threads' | 'messages' | 'memories' | 'runs';

/** Index specification for a collection (key direction + optional uniqueness). */
export type IndexSpec = {
  key: Record<string, 1 | -1>;
  unique?: boolean;
};

export interface MongoConnection {
  connect(): Promise<void>;
  getDb(): Db;
  close(): Promise<void>;
  health(): Promise<HealthStatus>;
}

export interface CreateMongoConnectionOptions {
  uri?: string;
  dbName?: string;
  client?: MongoClient;
}

export interface CreateMongoPersistenceOptions {
  connection: MongoConnection;
}
