import type { Db, MongoClient } from 'mongodb';

import type { ConversationStage } from '../enums/ConversationStage.js';
import type { DecisionAction } from '../enums/DecisionAction.js';
import type { EscalationStatus } from '../enums/EscalationStatus.js';
import type { HealthStatus } from './persistence.js';

/**
 * Collection names this service owns. The values themselves live in
 * `src/persistence/models/Collections.ts` (single source of truth, guarded with
 * a `satisfies` check against this union).
 */
export type CollectionName =
  | 'threads'
  | 'messages'
  | 'memories'
  | 'runs'
  | 'conversation_states'
  | 'decisions'
  | 'escalations';

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

/** Stored body of a `conversation_states` document (`_id` is lifted to `id` by the repository). */
export interface ConversationStateDocument {
  threadId: string;
  stage: ConversationStage;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Stored body of a `decisions` document (`_id` is lifted to `id` by the repository). */
export interface DecisionDocument {
  runId: string;
  threadId: string;
  schemaVersion: number;
  intent: string;
  action: DecisionAction;
  confidence: number;
  decision: Record<string, unknown>;
  validation: {
    valid: boolean;
    errors: string[];
  };
  fallback: boolean;
  createdAt: string;
}

/** Stored body of an `escalations` document (`_id` is lifted to `id` by the repository). */
export interface EscalationRecordDocument {
  threadId: string;
  runId: string | undefined;
  topicKey: string;
  detectedIntent: string | undefined;
  reason: string;
  summary: string;
  department: string;
  priority: string;
  status: EscalationStatus;
  createdAt: string;
  updatedAt: string;
}
