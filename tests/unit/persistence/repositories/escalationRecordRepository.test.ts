import { ObjectId } from 'mongodb';
import {
  describe, expect, it
} from 'vitest';

import { EscalationStatus } from '@enums/EscalationStatus.js';
import { createEscalationRecordRepository } from '@persistence/repositories/EscalationRecordRepository.js';
import { asDb, createFakeDb } from './fakeMongo.js';

const setup = () => {
  const fakeDb = createFakeDb();
  return {
    fakeDb,
    repo: createEscalationRecordRepository(asDb(fakeDb))
  };
};

const escalationInput = (threadId = 'thread-1') => ({
  threadId,
  runId: 'run-1',
  topicKey: 'payments',
  detectedIntent: 'quote',
  reason: 'customer asked for an agent',
  summary: 'handoff requested',
  department: 'sales',
  priority: 'high',
});

const escalationDoc = (id: ObjectId, threadId: string, createdAt: string) => ({
  _id: id,
  threadId,
  runId: 'run-1',
  topicKey: 'payments',
  detectedIntent: 'quote',
  reason: 'customer asked for an agent',
  summary: 'handoff requested',
  department: 'sales',
  priority: 'high',
  status: EscalationStatus.Pending,
  createdAt,
  updatedAt: createdAt,
});

describe('escalationRecordRepository',
  () => {
    it('creates an escalation in the pending state',
      async () => {
        const {
          fakeDb, repo
        } = setup();

        const record = await repo.create(escalationInput());

        expect(record).toMatchObject({
          threadId: 'thread-1',
          runId: 'run-1',
          topicKey: 'payments',
          detectedIntent: 'quote',
          reason: 'customer asked for an agent',
          summary: 'handoff requested',
          department: 'sales',
          priority: 'high',
          status: EscalationStatus.Pending,
        });
        expect(record.id).toMatch(/^[a-f0-9]{24}$/);
        expect(record.createdAt).toBe(record.updatedAt);
        expect(fakeDb.collection('escalations').docs).toHaveLength(1);
      });

    it('leaves runId and detectedIntent physically absent when omitted',
      async () => {
        const {
          fakeDb, repo
        } = setup();

        const record = await repo.create({
          threadId: 'thread-1',
          topicKey: 'payments',
          reason: 'customer asked for an agent',
          summary: 'handoff requested',
          department: 'sales',
          priority: 'high',
        });

        expect(record.runId).toBeUndefined();
        expect(record.detectedIntent).toBeUndefined();
        // Writing `undefined` would persist the keys as null — they must stay
        // physically absent in the stored document.
        const stored = fakeDb.collection('escalations').docs[0];
        expect(stored).not.toHaveProperty('runId');
        expect(stored).not.toHaveProperty('detectedIntent');
        expect(record).toHaveProperty('runId');
        expect(record).toHaveProperty('detectedIntent');
      });

    it('updates the status and bumps updatedAt',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        const id = new ObjectId();
        fakeDb.collection('escalations').docs.push(escalationDoc(id, 'thread-1', '2000-01-01T00:00:00.000Z'));

        const updated = await repo.updateStatus(id.toString(), EscalationStatus.Acknowledged);

        expect(updated).toMatchObject({
          id: id.toString(),
          status: EscalationStatus.Acknowledged,
          threadId: 'thread-1',
        });
        expect(updated.createdAt).toBe('2000-01-01T00:00:00.000Z');
        expect(updated.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
      });

    it('throws PERSISTENCE_NOT_FOUND for an invalid or missing escalation',
      async () => {
        const { repo } = setup();

        await expect(
          repo.updateStatus(new ObjectId().toString(), EscalationStatus.Resolved),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_NOT_FOUND',
          status: 404,
        });
        await expect(
          repo.updateStatus('not-an-object-id', EscalationStatus.Resolved),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_NOT_FOUND',
          status: 404,
        });
      });

    it('lists escalations of a thread newest first with pagination',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        const docs = fakeDb.collection('escalations').docs;
        docs.push(escalationDoc(new ObjectId(), 'thread-1', '2024-01-01T00:00:00.000Z'));
        docs.push(escalationDoc(new ObjectId(), 'thread-1', '2024-02-01T00:00:00.000Z'));
        docs.push(escalationDoc(new ObjectId(), 'thread-1', '2024-03-01T00:00:00.000Z'));
        docs.push(escalationDoc(new ObjectId(), 'thread-2', '2024-04-01T00:00:00.000Z'));

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
        expect(firstPage.items.map((item) => item.createdAt)).toEqual([
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
        expect(secondPage.items).toHaveLength(1);
        expect(secondPage.items[0]?.createdAt).toBe('2024-01-01T00:00:00.000Z');
      });

    it('maps driver failures to PERSISTENCE_QUERY_ERROR',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        const id = new ObjectId();
        fakeDb.collection('escalations').docs.push(escalationDoc(id, 'thread-1', '2024-01-01T00:00:00.000Z'));
        const escalations = fakeDb.collection('escalations');
        escalations.insertOne.mockRejectedValueOnce(new Error('write failed'));
        escalations.updateOne.mockRejectedValueOnce(new Error('update failed'));
        escalations.countDocuments.mockRejectedValueOnce(new Error('count failed'));

        await expect(repo.create(escalationInput())).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          status: 500,
          details: { cause: 'write failed' },
        });
        await expect(
          repo.updateStatus(id.toString(), EscalationStatus.Resolved),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'update failed' },
        });
        await expect(repo.listByThread('thread-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'count failed' },
        });
      });
  });
