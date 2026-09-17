import { ObjectId } from 'mongodb';
import {
  describe, expect, it
} from 'vitest';

import { DecisionAction } from '@enums/DecisionAction.js';
import { createDecisionRepository } from '@persistence/repositories/DecisionRepository.js';
import { asDb, createFakeDb } from './fakeMongo.js';

const setup = () => {
  const fakeDb = createFakeDb();
  return {
    fakeDb,
    repo: createDecisionRepository(asDb(fakeDb))
  };
};

const decisionInput = (runId: string, threadId = 'thread-1') => ({
  runId,
  threadId,
  schemaVersion: 1,
  intent: 'quote',
  action: DecisionAction.Respond,
  confidence: 0.9,
  decision: { reply: 'hello' },
  validation: {
    valid: true,
    errors: [] as string[],
  },
  fallback: false,
});

const decisionDoc = (id: ObjectId, runId: string, threadId: string, createdAt: string) => ({
  _id: id,
  runId,
  threadId,
  schemaVersion: 1,
  intent: 'quote',
  action: DecisionAction.Respond,
  confidence: 0.9,
  decision: { reply: 'hello' },
  validation: {
    valid: true,
    errors: [],
  },
  fallback: false,
  createdAt,
});

describe('decisionRepository',
  () => {
    it('creates a decision with a generated id and timestamp',
      async () => {
        const {
          fakeDb, repo
        } = setup();

        const decision = await repo.create(decisionInput('run-1'));

        expect(decision).toMatchObject({
          runId: 'run-1',
          threadId: 'thread-1',
          schemaVersion: 1,
          intent: 'quote',
          action: DecisionAction.Respond,
          confidence: 0.9,
          decision: { reply: 'hello' },
          validation: {
            valid: true,
            errors: [],
          },
          fallback: false,
        });
        expect(decision.id).toMatch(/^[a-f0-9]{24}$/);
        expect(typeof decision.createdAt).toBe('string');
        expect(fakeDb.collection('decisions').docs).toHaveLength(1);
        await expect(repo.findByRunId('run-1')).resolves.toEqual(decision);
      });

    it('maps duplicate run ids to PERSISTENCE_DUPLICATE_KEY',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        fakeDb
          .collection('decisions')
          .insertOne.mockRejectedValueOnce(
            Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
          );

        await expect(repo.create(decisionInput('run-1'))).rejects.toMatchObject({
          code: 'PERSISTENCE_DUPLICATE_KEY',
          status: 409,
          details: { cause: 'E11000 duplicate key' },
        });
      });

    it('returns null for an unknown run id',
      async () => {
        const { repo } = setup();

        await expect(repo.findByRunId('run-unknown')).resolves.toBeNull();
      });

    it('lists decisions of a thread oldest first with pagination',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        const docs = fakeDb.collection('decisions').docs;
        docs.push(decisionDoc(new ObjectId(), 'run-1', 'thread-1', '2024-01-01T00:00:00.000Z'));
        docs.push(decisionDoc(new ObjectId(), 'run-2', 'thread-1', '2024-02-01T00:00:00.000Z'));
        docs.push(decisionDoc(new ObjectId(), 'run-3', 'thread-1', '2024-03-01T00:00:00.000Z'));
        docs.push(decisionDoc(new ObjectId(), 'run-4', 'thread-2', '2024-04-01T00:00:00.000Z'));

        const firstPage = await repo.listByThread('thread-1',
          {
            page: 1,
            perPage: 2
          });

        expect(firstPage).toMatchObject({
          total: 3,
          page: 1,
          perPage: 2,
          hasNextPage: true
        });
        expect(firstPage.items.map((item) => item.runId)).toEqual([
          'run-1',
          'run-2',
        ]);

        const secondPage = await repo.listByThread('thread-1',
          {
            page: 2,
            perPage: 2
          });

        expect(secondPage).toMatchObject({
          total: 3,
          page: 2,
          perPage: 2,
          hasNextPage: false
        });
        expect(secondPage.items.map((item) => item.runId)).toEqual(['run-3']);
      });

    it('defaults to page 1 / perPage 50',
      async () => {
        const { repo } = setup();
        await repo.create(decisionInput('run-1'));

        const result = await repo.listByThread('thread-1');

        expect(result).toMatchObject({
          page: 1,
          perPage: 50,
          total: 1,
          hasNextPage: false
        });
      });

    it('maps driver failures to PERSISTENCE_QUERY_ERROR',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        const decisions = fakeDb.collection('decisions');
        decisions.insertOne.mockRejectedValueOnce(new Error('write failed'));
        decisions.findOne.mockRejectedValueOnce(new Error('read failed'));
        decisions.countDocuments.mockRejectedValueOnce(new Error('count failed'));

        await expect(repo.create(decisionInput('run-1'))).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          status: 500,
          details: { cause: 'write failed' },
        });
        await expect(repo.findByRunId('run-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'read failed' },
        });
        await expect(repo.listByThread('thread-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'count failed' },
        });
      });
  });
