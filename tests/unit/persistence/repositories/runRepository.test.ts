import { ObjectId } from 'mongodb';
import {
  describe, expect, it 
} from 'vitest';

import { RunStatus } from '@enums/RunStatus.js';
import { createRunRepository } from '@persistence/repositories/RunRepository.js';
import { asDb, createFakeDb } from './fakeMongo.js';

const setup = () => {
  const fakeDb = createFakeDb();
  return {
    fakeDb,
    repo: createRunRepository(asDb(fakeDb)) 
  };
};

const runDoc = (id: ObjectId, threadId: string, startedAt: string) => ({
  _id: id,
  threadId,
  type: 'routing',
  status: 'completed',
  input: {},
  startedAt,
});

describe('runRepository',
  () => {
    it('creates a run in the running state',
      async () => {
        const {
          fakeDb, repo 
        } = setup();

        const run = await repo.create({
          threadId: 'thread-1',
          type: 'routing',
          input: { attempts: 1 },
        });

        expect(run).toMatchObject({
          threadId: 'thread-1',
          type: 'routing',
          status: RunStatus.Running,
          input: { attempts: 1 },
        });
        expect(run.id).toMatch(/^[a-f0-9]{24}$/);
        expect(typeof run.startedAt).toBe('string');
        expect(run.output).toBeUndefined();
        expect(run.error).toBeUndefined();
        expect(run.completedAt).toBeUndefined();
        expect(fakeDb.collection('runs').docs).toHaveLength(1);
        // Absent output/error/completedAt keys must stay physically absent in the
        // stored document — writing `undefined` would persist them as null.
        const stored = fakeDb.collection('runs').docs[0];
        expect(stored?.status).toBe(RunStatus.Running);
        expect(stored).not.toHaveProperty('output');
        expect(stored).not.toHaveProperty('error');
        expect(stored).not.toHaveProperty('completedAt');
      });

    it('returns null for unknown and invalid ids',
      async () => {
        const { repo } = setup();

        await expect(repo.findById(new ObjectId().toString())).resolves.toBeNull();
        await expect(repo.findById('invalid')).resolves.toBeNull();
      });

    it('applies only the provided fields on update',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const id = new ObjectId();
        fakeDb.collection('runs').docs.push(runDoc(id, 'thread-1', '2024-01-01T00:00:00.000Z'));

        const updated = await repo.update(id.toString(),
          {
            status: RunStatus.Completed,
            output: { route: 'ai' },
            completedAt: '2024-01-01T00:00:05.000Z',
          });

        expect(updated).toMatchObject({
          id: id.toString(),
          status: RunStatus.Completed,
          output: { route: 'ai' },
          completedAt: '2024-01-01T00:00:05.000Z',
          type: 'routing',
          startedAt: '2024-01-01T00:00:00.000Z',
        });
        expect(updated.error).toBeUndefined();
      });

    it('treats an empty update as a read-only existence check',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const id = new ObjectId();
        fakeDb.collection('runs').docs.push(runDoc(id, 'thread-1', '2024-01-01T00:00:00.000Z'));

        const existing = await repo.update(id.toString(), {});

        expect(existing.id).toBe(id.toString());
        expect(fakeDb.collection('runs').updateOne).not.toHaveBeenCalled();
      });

    it('throws PERSISTENCE_NOT_FOUND when the run is missing or the id is invalid',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const id = new ObjectId();
        fakeDb.collection('runs').docs.push(runDoc(id, 'thread-1', '2024-01-01T00:00:00.000Z'));

        await expect(
          repo.update(new ObjectId().toString(), { status: RunStatus.Failed }),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_NOT_FOUND',
          status: 404,
        });
        await expect(repo.update('invalid', { status: RunStatus.Failed })).rejects.toMatchObject({
          code: 'PERSISTENCE_NOT_FOUND',
          status: 404,
        });
        await expect(repo.update(id.toString(), {})).resolves.toMatchObject({ id: id.toString() });
        await expect(repo.update(new ObjectId().toString(), {})).rejects.toMatchObject({
          code: 'PERSISTENCE_NOT_FOUND',
          status: 404,
        });
      });

    it('clamps invalid pagination to page 1 / perPage 1',
      async () => {
        const { repo } = setup();

        const result = await repo.listByThread('thread-1',
          {
            page: 0,
            perPage: 0 
          });
        expect(result).toMatchObject({
          page: 1,
          perPage: 1 
        });

        const negative = await repo.listByThread('thread-1',
          {
            page: -2,
            perPage: -5 
          });
        expect(negative).toMatchObject({
          page: 1,
          perPage: 1 
        });
      });

    it('lists runs of a thread newest first with pagination',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const docs = fakeDb.collection('runs').docs;
        docs.push(runDoc(new ObjectId(), 'thread-1', '2024-01-01T00:00:00.000Z'));
        docs.push(runDoc(new ObjectId(), 'thread-1', '2024-02-01T00:00:00.000Z'));
        docs.push(runDoc(new ObjectId(), 'thread-1', '2024-03-01T00:00:00.000Z'));
        docs.push(runDoc(new ObjectId(), 'thread-2', '2024-04-01T00:00:00.000Z'));

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
        expect(firstPage.items.map((item) => item.startedAt)).toEqual([
          '2024-03-01T00:00:00.000Z',
          '2024-02-01T00:00:00.000Z',
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
        expect(secondPage.items[0]?.startedAt).toBe('2024-01-01T00:00:00.000Z');
      });

    it('maps driver failures to PERSISTENCE_QUERY_ERROR',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const runs = fakeDb.collection('runs');
        const id = new ObjectId();
        runs.insertOne.mockRejectedValueOnce(new Error('write failed'));
        runs.findOne.mockRejectedValueOnce(new Error('read failed'));
        runs.updateOne.mockRejectedValueOnce(new Error('update failed'));
        runs.countDocuments.mockRejectedValueOnce(new Error('count failed'));

        await expect(
          repo.create({
            threadId: 'thread-1',
            type: 'routing',
            input: {} 
          }),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          status: 500,
          details: { cause: 'write failed' },
        });
        await expect(repo.findById(id.toString())).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'read failed' },
        });
        await expect(repo.update(id.toString(), { status: RunStatus.Failed })).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'update failed' },
        });
        await expect(repo.listByThread('thread-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'count failed' },
        });
      });
  });
