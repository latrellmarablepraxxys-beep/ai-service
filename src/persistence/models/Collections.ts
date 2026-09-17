/**
 * MongoDB collection registry + index specifications.
 *
 * Aggregated from the per-entity models (`Thread`, `Message`, `Memory`, `Run`),
 * which own each collection's name, indexes, document schema and mappers. This
 * module stays the single source of truth consumed by `scripts/initCollections.ts`
 * and `scripts/createIndexes.ts` (collection + index bootstrap).
 */

import type { CollectionName, IndexSpec } from '../../interfaces/mongo.js';
import { CONVERSATION_STATE_COLLECTION, CONVERSATION_STATE_INDEXES } from './ConversationState.js';
import { DECISION_COLLECTION, DECISION_INDEXES } from './Decision.js';
import { ESCALATION_COLLECTION, ESCALATION_INDEXES } from './Escalation.js';
import { MEMORY_COLLECTION, MEMORY_INDEXES } from './Memory.js';
import { MESSAGE_COLLECTION, MESSAGE_INDEXES } from './Message.js';
import { RUN_COLLECTION, RUN_INDEXES } from './Run.js';
import { THREAD_COLLECTION, THREAD_INDEXES } from './Thread.js';

export const COLLECTIONS = Object.freeze({
  threads: THREAD_COLLECTION,
  messages: MESSAGE_COLLECTION,
  memories: MEMORY_COLLECTION,
  runs: RUN_COLLECTION,
  conversation_states: CONVERSATION_STATE_COLLECTION,
  decisions: DECISION_COLLECTION,
  escalations: ESCALATION_COLLECTION,
} as const) satisfies Record<CollectionName, CollectionName>;

export const COLLECTION_INDEXES: Readonly<Record<CollectionName, IndexSpec[]>> = Object.freeze({
  threads: [...THREAD_INDEXES],
  messages: [...MESSAGE_INDEXES],
  memories: [...MEMORY_INDEXES],
  runs: [...RUN_INDEXES],
  conversation_states: [...CONVERSATION_STATE_INDEXES],
  decisions: [...DECISION_INDEXES],
  escalations: [...ESCALATION_INDEXES],
});
