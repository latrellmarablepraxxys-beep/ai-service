import { ObjectId } from 'mongodb';
import {
  describe, expect, it 
} from 'vitest';

import { ThreadStatus } from '@enums/ThreadStatus.js';
import { createThreadRepository } from '@persistence/repositories/ThreadRepository.js';
import { asDb, createFakeDb } from './fakeMongo.js';

const setup = () => {
  const fakeDb = createFakeDb();
  return {
    fakeDb,
    repo: createThreadRepository(asDb(fakeDb)) 
  };
};

const threadDoc = (id: ObjectId, updatedAt: string) => ({
  _id: id,
  ticketId: 't-1',
  status: ThreadStatus.Active,
  route: 'ai',
  metadata: {},
  createdAt: updatedAt,
  updatedAt,
});

describe('threadRepository',
  () => {
    it('creates a thread with a generated id, defaults and timestamps',
      async () => {
        const {
          fakeDb, repo 
        } = setup();

        const thread = await repo.create({
          ticketId: 't-1',
          route: 'ai' 
        });

        expect(thread.id).toMatch(/^[a-f0-9]{24}$/);
        expect(thread).toMatchObject({
          ticketId: 't-1',
          status: ThreadStatus.Active,
          route: 'ai',
          metadata: {},
        });
        expect(thread.createdAt).toBe(thread.updatedAt);
        expect(fakeDb.collection('threads').docs[0]?.status).toBe(ThreadStatus.Active);
        expect(fakeDb.collection('threads').docs).toHaveLength(1);
        await expect(repo.findById(thread.id)).resolves.toEqual(thread);
      });

    it('keeps the provided metadata',
      async () => {
        const { repo } = setup();

        const thread = await repo.create({
          ticketId: 't-1',
          route: 'queue',
          metadata: { channel: 'wa' },
        });

        expect(thread.metadata).toEqual({ channel: 'wa' });
      });

    it('returns null for unknown and invalid ids',
      async () => {
        const { repo } = setup();

        await expect(repo.findById(new ObjectId().toString())).resolves.toBeNull();
        await expect(repo.findById('not-an-object-id')).resolves.toBeNull();
      });

    it('finds a thread by ticket id',
      async () => {
        const { repo } = setup();
        const created = await repo.create({
          ticketId: 't-1',
          route: 'ai' 
        });

        await expect(repo.findByTicketId('t-1')).resolves.toEqual(created);
        await expect(repo.findByTicketId('t-2')).resolves.toBeNull();
      });

    it('applies only the provided fields on update and bumps updatedAt',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const id = new ObjectId();
        fakeDb.collection('threads').docs.push(threadDoc(id, '2000-01-01T00:00:00.000Z'));

        const updated = await repo.update(id.toString(), { status: ThreadStatus.Escalated });

        expect(updated).toMatchObject({
          id: id.toString(),
          status: ThreadStatus.Escalated,
          route: 'ai',
          metadata: {},
          ticketId: 't-1',
        });
        expect(updated.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
        expect(updated.createdAt).toBe('2000-01-01T00:00:00.000Z');
      });

    it('throws PERSISTENCE_NOT_FOUND when updating a missing or invalid thread',
      async () => {
        const { repo } = setup();

        await expect(
          repo.update(new ObjectId().toString(), { status: ThreadStatus.Closed }),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_NOT_FOUND',
          status: 404,
        });
        await expect(repo.update('not-an-object-id', { status: ThreadStatus.Closed })).rejects.toMatchObject(
          {
            code: 'PERSISTENCE_NOT_FOUND',
            status: 404,
          },
        );
      });

    it('paginates threads by ticket, newest first',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const docs = fakeDb.collection('threads').docs;
        docs.push(threadDoc(new ObjectId(), '2024-01-01T00:00:00.000Z'));
        docs.push(threadDoc(new ObjectId(), '2024-02-01T00:00:00.000Z'));
        docs.push(threadDoc(new ObjectId(), '2024-03-01T00:00:00.000Z'));
        docs.push({
          ...threadDoc(new ObjectId(), '2024-04-01T00:00:00.000Z'),
          ticketId: 't-2'
        });

        const firstPage = await repo.listByTicketId('t-1',
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
        expect(firstPage.items.map((item) => item.updatedAt)).toEqual([
          '2024-03-01T00:00:00.000Z',
          '2024-02-01T00:00:00.000Z',
        ]);

        const secondPage = await repo.listByTicketId('t-1',
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
        expect(secondPage.items[0]?.updatedAt).toBe('2024-01-01T00:00:00.000Z');
      });

    it('defaults to page 1 / perPage 50',
      async () => {
        const { repo } = setup();
        await repo.create({
          ticketId: 't-1',
          route: 'ai' 
        });

        const result = await repo.listByTicketId('t-1');

        expect(result).toMatchObject({
          page: 1,
          perPage: 50,
          total: 1,
          hasNextPage: false 
        });
      });

    it('maps duplicate key errors to PERSISTENCE_DUPLICATE_KEY',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        fakeDb
          .collection('threads')
          .insertOne.mockRejectedValueOnce(
            Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
          );

        await expect(repo.create({
          ticketId: 't-1',
          route: 'ai' 
        })).rejects.toMatchObject({
          code: 'PERSISTENCE_DUPLICATE_KEY',
          status: 409,
          details: { cause: 'E11000 duplicate key' },
        });
      });

    it('maps driver failures to PERSISTENCE_QUERY_ERROR and keeps the cause',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const threads = fakeDb.collection('threads');
        threads.insertOne.mockRejectedValueOnce(new Error('write failed'));
        threads.findOne.mockRejectedValueOnce(new Error('read failed'));
        threads.findOne.mockRejectedValueOnce(new Error('read failed'));
        threads.countDocuments.mockRejectedValueOnce(new Error('count failed'));

        await expect(repo.create({
          ticketId: 't-1',
          route: 'ai' 
        })).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          status: 500,
          details: { cause: 'write failed' },
        });
        await expect(repo.findById(new ObjectId().toString())).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'read failed' },
        });
        await expect(repo.findByTicketId('t-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'read failed' },
        });
        await expect(repo.listByTicketId('t-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'count failed' },
        });
      });

    it('maps update driver failures to PERSISTENCE_QUERY_ERROR',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const id = new ObjectId();
        fakeDb.collection('threads').docs.push(threadDoc(id, '2000-01-01T00:00:00.000Z'));
        fakeDb.collection('threads').updateOne.mockRejectedValueOnce(new Error('update failed'));

        await expect(repo.update(id.toString(), { status: ThreadStatus.Closed })).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'update failed' },
        });
      });
  });
