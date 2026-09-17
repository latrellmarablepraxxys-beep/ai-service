import type { Db } from 'mongodb';

import { EscalationStatus } from '../../enums/EscalationStatus.js';
import type {
  CreateEscalationInput,
  EntityId,
  EscalationRecordRepository,
} from '../../interfaces/persistence.js';
import {
  ESCALATION_COLLECTION,
  toEscalationRecord,
  type EscalationRecordDocument,
} from '../models/Escalation.js';
import {
  notFoundError,
  nowIso,
  resolvePagination,
  toObjectId,
  toPaginatedResult,
  toPersistenceError,
} from './Helpers.js';

export const createEscalationRecordRepository = (db: Db): EscalationRecordRepository => {
  const escalations = db.collection<EscalationRecordDocument>(ESCALATION_COLLECTION);

  return {
    async create(input: CreateEscalationInput) {
      // `runId` / `detectedIntent` are spread in only when defined — writing
      // `undefined` would store the keys as null, diverging from the document
      // contract.
      const timestamp = nowIso();
      const doc = {
        threadId: input.threadId,
        topicKey: input.topicKey,
        reason: input.reason,
        summary: input.summary,
        department: input.department,
        priority: input.priority,
        status: EscalationStatus.Pending,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...(input.runId !== undefined && { runId: input.runId }),
        ...(input.detectedIntent !== undefined && { detectedIntent: input.detectedIntent }),
      } as EscalationRecordDocument;

      try {
        const result = await escalations.insertOne(doc);
        return {
          id: result.insertedId.toString(),
          ...doc,
          runId: doc.runId ?? undefined,
          detectedIntent: doc.detectedIntent ?? undefined,
        };
      } catch (error) {
        throw toPersistenceError(error, `Failed to create escalation for thread "${input.threadId}"`);
      }
    },

    async updateStatus(id: EntityId, status: EscalationStatus) {
      const objectId = toObjectId(id);
      if (!objectId) throw notFoundError(`Escalation "${id}" not found`);

      try {
        const result = await escalations.updateOne(
          { _id: objectId },
          {
            $set: {
              status,
              updatedAt: nowIso() 
            } 
          },
        );
        if (result.matchedCount === 0) throw notFoundError(`Escalation "${id}" not found`);

        const doc = await escalations.findOne({ _id: objectId });
        if (!doc) throw notFoundError(`Escalation "${id}" not found`);

        return toEscalationRecord(doc);
      } catch (error) {
        throw toPersistenceError(error, `Failed to update escalation "${id}"`);
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
          escalations.find(filter).sort({
            createdAt: -1,
            _id: -1
          }).skip(skip).limit(limit).toArray(),
          escalations.countDocuments(filter),
        ]);

        return toPaginatedResult(docs.map(toEscalationRecord), total, page, perPage);
      } catch (error) {
        throw toPersistenceError(error, `Failed to list escalations for thread "${threadId}"`);
      }
    },
  };
};
