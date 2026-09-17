import type { Db } from 'mongodb';

import { RunStatus } from '../../enums/RunStatus.js';
import type {
  CreateRunInput,
  EntityId,
  Run,
  RunRepository,
  UpdateRunInput,
} from '../../interfaces/persistence.js';
import {
  RUN_COLLECTION, toRun, toRunDocument, type RunDocument 
} from '../models/Run.js';
import {
  notFoundError,
  nowIso,
  resolvePagination,
  toObjectId,
  toPaginatedResult,
  toPersistenceError,
} from './Helpers.js';

export const createRunRepository = (db: Db): RunRepository => {
  const runs = db.collection<RunDocument>(RUN_COLLECTION);

  return {
    async create(input: CreateRunInput): Promise<Run> {
      // `CreateRunInput` carries only threadId/type/input — output, error and
      // completedAt are absent on create. Omitting them (instead of writing
      // `undefined`) keeps the stored document free of null-valued keys.
      const doc = {
        threadId: input.threadId,
        type: input.type,
        status: RunStatus.Running,
        input: input.input,
        startedAt: nowIso(),
      } as RunDocument;

      try {
        const document = toRunDocument(doc);
        const result = await runs.insertOne(document);
        return {
          id: result.insertedId.toString(),
          ...document,
          output: undefined,
          error: undefined,
          completedAt: undefined,
        };
      } catch (error) {
        throw toPersistenceError(error, `Failed to create run for thread "${input.threadId}"`);
      }
    },

    async findById(id: EntityId): Promise<Run | null> {
      const objectId = toObjectId(id);
      if (!objectId) return null;

      try {
        const doc = await runs.findOne({ _id: objectId });
        return doc ? toRun(doc) : null;
      } catch (error) {
        throw toPersistenceError(error, `Failed to find run "${id}"`);
      }
    },

    async update(id: EntityId, input: UpdateRunInput): Promise<Run> {
      const objectId = toObjectId(id);
      if (!objectId) throw notFoundError(`Run "${id}" not found`);

      const $set: Partial<RunDocument> = {};
      if (input.status !== undefined) $set.status = input.status;
      if (input.output !== undefined) $set.output = input.output;
      if (input.error !== undefined) $set.error = input.error;
      if (input.completedAt !== undefined) $set.completedAt = input.completedAt;
      if (input.model !== undefined) $set.model = input.model;
      if (input.promptKey !== undefined) $set.promptKey = input.promptKey;
      if (input.promptVersion !== undefined) $set.promptVersion = input.promptVersion;
      if (input.usage !== undefined) $set.usage = input.usage;
      if (input.latencyMs !== undefined) $set.latencyMs = input.latencyMs;
      if (input.knowledgeUsed !== undefined) $set.knowledgeUsed = input.knowledgeUsed;

      try {
        // Defensive read-only branch: never sends an empty `$set`. MongoDB 7 +
        // driver 6 accept it as a no-op, but older servers reject it, and
        // keeping the read-only path explicit preserves the read-side mapping.
        if (Object.keys($set).length === 0) {
          const existing = await runs.findOne({ _id: objectId });
          if (!existing) throw notFoundError(`Run "${id}" not found`);
          return toRun(existing);
        }

        const result = await runs.updateOne({ _id: objectId }, { $set });
        if (result.matchedCount === 0) throw notFoundError(`Run "${id}" not found`);

        const doc = await runs.findOne({ _id: objectId });
        if (!doc) throw notFoundError(`Run "${id}" not found`);

        return toRun(doc);
      } catch (error) {
        throw toPersistenceError(error, `Failed to update run "${id}"`);
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
          runs.find(filter).sort({
            startedAt: -1,
            _id: -1 
          }).skip(skip).limit(limit).toArray(),
          runs.countDocuments(filter),
        ]);

        return toPaginatedResult(docs.map(toRun), total, page, perPage);
      } catch (error) {
        throw toPersistenceError(error, `Failed to list runs for thread "${threadId}"`);
      }
    },
  };
};
