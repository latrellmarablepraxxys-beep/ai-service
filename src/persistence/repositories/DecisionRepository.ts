import type { Db } from 'mongodb';

import type {
  CreateDecisionInput,
  DecisionRepository,
  EntityId,
} from '../../interfaces/persistence.js';
import {
  DECISION_COLLECTION,
  toDecision,
  type DecisionDocument,
} from '../models/Decision.js';
import {
  nowIso,
  resolvePagination,
  toPaginatedResult,
  toPersistenceError,
} from './Helpers.js';

export const createDecisionRepository = (db: Db): DecisionRepository => {
  const decisions = db.collection<DecisionDocument>(DECISION_COLLECTION);

  return {
    async create(input: CreateDecisionInput) {
      const doc: DecisionDocument = {
        runId: input.runId,
        threadId: input.threadId,
        schemaVersion: input.schemaVersion,
        intent: input.intent,
        action: input.action,
        confidence: input.confidence,
        decision: input.decision,
        validation: input.validation,
        fallback: input.fallback,
        createdAt: nowIso(),
      };

      try {
        const result = await decisions.insertOne(doc);
        return {
          id: result.insertedId.toString(),
          ...doc,
        };
      } catch (error) {
        throw toPersistenceError(error, `Failed to create decision for run "${input.runId}"`);
      }
    },

    async findByRunId(runId: EntityId) {
      try {
        const doc = await decisions.findOne({ runId });
        return doc ? toDecision(doc) : null;
      } catch (error) {
        throw toPersistenceError(error, `Failed to find decision for run "${runId}"`);
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
          decisions.find(filter).sort({
            createdAt: 1,
            _id: 1
          }).skip(skip).limit(limit).toArray(),
          decisions.countDocuments(filter),
        ]);

        return toPaginatedResult(docs.map(toDecision), total, page, perPage);
      } catch (error) {
        throw toPersistenceError(error, `Failed to list decisions for thread "${threadId}"`);
      }
    },
  };
};
