import type { Db } from 'mongodb';

import type {
  ConversationStateRepository,
  EntityId,
  UpsertConversationStateInput,
} from '../../interfaces/persistence.js';
import { AppError } from '../../utils/errors.js';
import {
  CONVERSATION_STATE_COLLECTION,
  toConversationState,
  type ConversationStateDocument,
} from '../models/ConversationState.js';
import { nowIso, toPersistenceError } from './Helpers.js';

export const createConversationStateRepository = (db: Db): ConversationStateRepository => {
  const states = db.collection<ConversationStateDocument>(CONVERSATION_STATE_COLLECTION);

  return {
    async findByThread(threadId: EntityId) {
      try {
        const doc = await states.findOne({ threadId });
        return doc ? toConversationState(doc) : null;
      } catch (error) {
        throw toPersistenceError(error, `Failed to find conversation state for thread "${threadId}"`);
      }
    },

    async upsert(input: UpsertConversationStateInput) {
      const timestamp = nowIso();
      const filter = { threadId: input.threadId };

      try {
        await states.updateOne(
          filter,
          {
            $set: {
              stage: input.stage,
              data: input.data ?? {},
              updatedAt: timestamp,
            },
            $setOnInsert: {
              threadId: input.threadId,
              createdAt: timestamp,
            },
          },
          { upsert: true },
        );

        const doc = await states.findOne(filter);
        if (!doc) {
          throw new AppError(
            'PERSISTENCE_QUERY_ERROR',
            500,
            `Conversation state upsert for thread "${input.threadId}" returned no document`,
          );
        }

        return toConversationState(doc);
      } catch (error) {
        throw toPersistenceError(error, `Failed to upsert conversation state for thread "${input.threadId}"`);
      }
    },
  };
};
