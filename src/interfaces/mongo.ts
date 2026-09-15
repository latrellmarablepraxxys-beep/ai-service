import type { Db, MongoClient } from 'mongodb';

import type {
  HealthStatus, Memory, Message, Run, Thread 
} from './persistence.js';

/**
 * Stored document shapes: identical to the port entities, except the boundary
 * `id` lives in MongoDB's `_id` (mapped inside the repositories).
 */
export type ThreadDocument = Omit<Thread, 'id'>;
export type MessageDocument = Omit<Message, 'id'>;
export type MemoryDocument = Omit<Memory, 'id'>;
export type RunDocument = Omit<Run, 'id'>;

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
