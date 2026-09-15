import type { Db, WithId } from 'mongodb';

import { ThreadStatus } from '../../enums/ThreadStatus.js';
import type { ThreadDocument } from '../../interfaces/mongo.js';
import type {
  CreateThreadInput,
  EntityId,
  Thread,
  ThreadRepository,
  UpdateThreadInput,
} from '../../interfaces/persistence.js';
import { COLLECTIONS } from '../models/Collections.js';
import {
  notFoundError,
  nowIso,
  resolvePagination,
  toObjectId,
  toPaginatedResult,
  toPersistenceError,
} from './Helpers.js';

export const createThreadRepository = (db: Db): ThreadRepository => {
  const threads = db.collection<ThreadDocument>(COLLECTIONS.threads);

  const toThread = (doc: WithId<ThreadDocument>): Thread => {
    const {
      _id, ...rest 
    } = doc;
    return {
      id: _id.toString(),
      ...rest,
    };
  };

  return {
    async create(input: CreateThreadInput): Promise<Thread> {
      const timestamp = nowIso();
      const doc: ThreadDocument = {
        ticketId: input.ticketId,
        status: ThreadStatus.Active,
        route: input.route,
        metadata: input.metadata ?? {},
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        const result = await threads.insertOne(doc);
        return {
          id: result.insertedId.toString(),
          ...doc 
        };
      } catch (error) {
        throw toPersistenceError(error, `Failed to create thread for ticket "${input.ticketId}"`);
      }
    },

    async findById(id: EntityId): Promise<Thread | null> {
      const objectId = toObjectId(id);
      if (!objectId) return null;

      try {
        const doc = await threads.findOne({ _id: objectId });
        return doc ? toThread(doc) : null;
      } catch (error) {
        throw toPersistenceError(error, `Failed to find thread "${id}"`);
      }
    },

    async findByTicketId(ticketId: string): Promise<Thread | null> {
      try {
        const doc = await threads.findOne({ ticketId });
        return doc ? toThread(doc) : null;
      } catch (error) {
        throw toPersistenceError(error, `Failed to find thread for ticket "${ticketId}"`);
      }
    },

    async update(id: EntityId, input: UpdateThreadInput): Promise<Thread> {
      const objectId = toObjectId(id);
      if (!objectId) throw notFoundError(`Thread "${id}" not found`);

      const $set: Partial<ThreadDocument> = { updatedAt: nowIso() };
      if (input.status !== undefined) $set.status = input.status;
      if (input.route !== undefined) $set.route = input.route;
      if (input.metadata !== undefined) $set.metadata = input.metadata;

      try {
        const result = await threads.updateOne({ _id: objectId }, { $set });
        if (result.matchedCount === 0) throw notFoundError(`Thread "${id}" not found`);

        const doc = await threads.findOne({ _id: objectId });
        if (!doc) throw notFoundError(`Thread "${id}" not found`);

        return toThread(doc);
      } catch (error) {
        throw toPersistenceError(error, `Failed to update thread "${id}"`);
      }
    },

    async listByTicketId(ticketId: string, params) {
      const {
        page, perPage, skip, limit 
      } = resolvePagination(params);
      const filter = { ticketId };

      try {
        const [
          docs,
          total
        ] = await Promise.all([
          threads.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
          threads.countDocuments(filter),
        ]);

        return toPaginatedResult(docs.map(toThread), total, page, perPage);
      } catch (error) {
        throw toPersistenceError(error, `Failed to list threads for ticket "${ticketId}"`);
      }
    },
  };
};
