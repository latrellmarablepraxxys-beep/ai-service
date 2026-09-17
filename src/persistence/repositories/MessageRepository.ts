import type { Db } from 'mongodb';

import type {
  CreateMessageInput,
  EntityId,
  Message,
  MessageRepository,
} from '../../interfaces/persistence.js';
import {
  MESSAGE_COLLECTION, toMessage, toMessageDocument, type MessageDocument 
} from '../models/Message.js';
import {
  nowIso,
  resolvePagination,
  toObjectId,
  toPaginatedResult,
  toPersistenceError,
} from './Helpers.js';

export const createMessageRepository = (db: Db): MessageRepository => {
  const messages = db.collection<MessageDocument>(MESSAGE_COLLECTION);

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
        const document = toMessageDocument(doc);
        const result = await messages.insertOne(document);
        return {
          id: result.insertedId.toString(),
          ...document,
          tokenCount: document.tokenCount ?? undefined,
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
