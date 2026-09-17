import type { WithId } from 'mongodb';

import type {
  CollectionName,
  ConversationStateDocument,
  IndexSpec,
} from '../../interfaces/mongo.js';
import type { ConversationState } from '../../interfaces/persistence.js';

export const CONVERSATION_STATE_COLLECTION = 'conversation_states' satisfies CollectionName;

export const CONVERSATION_STATE_INDEXES: readonly IndexSpec[] = [
  {
    key: { threadId: 1 },
    unique: true,
  },
];

export type { ConversationStateDocument };

/** Read mapper: drops `_id` (`ConversationState` is keyed by `threadId`). */
export const toConversationState = (doc: WithId<ConversationStateDocument>): ConversationState => ({
  threadId: doc.threadId,
  stage: doc.stage,
  data: doc.data,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
