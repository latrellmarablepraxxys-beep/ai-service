import type { Db, WithId } from 'mongodb';

import type { MessageDocument } from '../../interfaces/mongo.js';
import type {
  CreateMessageInput,
  EntityId,
  Message,
  MessageRepository,
} from '../../interfaces/persistence.js';
import { COLLECTIONS } from '../models/Collections.js';
import {
  nowIso,
  resolvePagination,
  toObjectId,
  toPaginatedResult,
  toPersistenceError,
} from './Helpers.js';

export const createMessageRepository = (db: Db): MessageRepository => {
  const messages = db.collection<MessageDocument>(COLLECTIONS.messages);

  const toMessage = (doc: WithId<MessageDocument>): Message => {
    const {
      _id, ...rest 
    } = doc;
    return {
      id: _id.toString(),
      ...rest,
      tokenCount: rest.tokenCount ?? undefined 
    };
  };

  return {
    async create(input: CreateMessageInput): Promise<Message> {
      // Omit `tokenCount` entirely when absent — writing `undefined` would
      // store the key as null, diverging from the `MessageDocument` contract.
      const doc = {
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        metadata: input.metadata ?? {},
        createdAt: nowIso(),
        ...(input.tokenCount !== undefined && { tokenCount: input.tokenCount }),
      } as MessageDocument;

      try {
        const result = await messages.insertOne(doc);
        return {
          id: result.insertedId.toString(),
          ...doc 
        };
      } catch (error) {
        throw toPersistenceError(error, `Failed to create message for thread "${input.threadId}"`);
      }
    },

    async findById(id: EntityId): Promise<Message | null> {
      const objectId = toObjectId(id);
      if (!objectId) return null;

      try {
        const doc = await messages.findOne({ _id: objectId });
        return doc ? toMessage(doc) : null;
      } catch (error) {
        throw toPersistenceError(error, `Failed to find message "${id}"`);
      }
    },

    async listByThread(threadId: EntityId, params) {
      const {
        page, perPage, skip, limit 
      } = resolvePagination(params);
      const filter = { threadId };

      try {
        const [
          docs,
          total
        ] = await Promise.all([
          messages.find(filter).sort({
            createdAt: 1,
            _id: 1 
          }).skip(skip).limit(limit).toArray(),
          messages.countDocuments(filter),
        ]);

        return toPaginatedResult(docs.map(toMessage), total, page, perPage);
      } catch (error) {
        throw toPersistenceError(error, `Failed to list messages for thread "${threadId}"`);
      }
    },
  };
};
