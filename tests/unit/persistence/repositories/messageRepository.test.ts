import { ObjectId } from 'mongodb';
import {
  describe, expect, it 
} from 'vitest';

import { createMessageRepository } from '@persistence/repositories/MessageRepository.js';
import { asDb, createFakeDb } from './fakeMongo.js';

const setup = () => {
  const fakeDb = createFakeDb();
  return {
    fakeDb,
    repo: createMessageRepository(asDb(fakeDb)) 
  };
};

const messageDoc = (threadId: string, createdAt: string, content: string) => ({
  _id: new ObjectId(),
  threadId,
  role: 'user',
  content,
  metadata: {},
  createdAt,
});

describe('messageRepository',
  () => {
    it('creates a message with a generated id and timestamp',
      async () => {
        const {
          fakeDb, repo 
        } = setup();

        const message = await repo.create({
          threadId: 'thread-1',
          role: 'assistant',
          content: 'hello',
          tokenCount: 3,
          metadata: { source: 'ai' },
        });

        expect(message).toMatchObject({
          threadId: 'thread-1',
          role: 'assistant',
          content: 'hello',
          tokenCount: 3,
          metadata: { source: 'ai' },
        });
        expect(message.id).toMatch(/^[a-f0-9]{24}$/);
        expect(typeof message.createdAt).toBe('string');
        await expect(repo.findById(message.id)).resolves.toEqual(message);
        expect(fakeDb.collection('messages').docs).toHaveLength(1);
        // tokenCount is defined here, so it must be present in the stored doc.
        expect(fakeDb.collection('messages').docs[0]).toMatchObject({ tokenCount: 3 });
      });

    it('defaults metadata and leaves tokenCount undefined',
      async () => {
        const {
          fakeDb, repo 
        } = setup();

        const message = await repo.create({
          threadId: 'thread-1',
          role: 'user',
          content: 'hi' 
        });

        expect(message.metadata).toEqual({});
        expect(message.tokenCount).toBeUndefined();
        // tokenCount was absent on create — the key must stay physically absent in
        // the stored document (writing `undefined` would persist it as null).
        expect(fakeDb.collection('messages').docs[0]).not.toHaveProperty('tokenCount');
      });

    it('returns null for unknown and invalid ids',
      async () => {
        const { repo } = setup();

        await expect(repo.findById(new ObjectId().toString())).resolves.toBeNull();
        await expect(repo.findById('invalid')).resolves.toBeNull();
      });

    it('lists messages of a thread in chronological order',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const docs = fakeDb.collection('messages').docs;
        docs.push(messageDoc('thread-1', '2024-01-03T00:00:00.000Z', 'third'));
        docs.push(messageDoc('thread-1', '2024-01-01T00:00:00.000Z', 'first'));
        docs.push(messageDoc('thread-1', '2024-01-02T00:00:00.000Z', 'second'));
        docs.push(messageDoc('thread-2', '2024-01-04T00:00:00.000Z', 'other thread'));

        const result = await repo.listByThread('thread-1');

        expect(result).toMatchObject({
          total: 3,
          page: 1,
          perPage: 50,
          hasNextPage: false 
        });
        expect(result.items.map((item) => item.content)).toEqual([
          'first',
          'second',
          'third'
        ]);
      });

    it('paginates messages with hasNextPage',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const docs = fakeDb.collection('messages').docs;
        docs.push(messageDoc('thread-1', '2024-01-01T00:00:00.000Z', 'first'));
        docs.push(messageDoc('thread-1', '2024-01-02T00:00:00.000Z', 'second'));
        docs.push(messageDoc('thread-1', '2024-01-03T00:00:00.000Z', 'third'));

        const page = await repo.listByThread('thread-1',
          {
            page: 2,
            perPage: 2 
          });

        expect(page).toMatchObject({
          total: 3,
          page: 2,
          perPage: 2,
          hasNextPage: false 
        });
        expect(page.items.map((item) => item.content)).toEqual(['third']);
      });

    it('maps driver failures to PERSISTENCE_QUERY_ERROR',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const messages = fakeDb.collection('messages');
        messages.insertOne.mockRejectedValueOnce(new Error('write failed'));
        messages.findOne.mockRejectedValueOnce(new Error('read failed'));
        messages.countDocuments.mockRejectedValueOnce(new Error('count failed'));

        await expect(
          repo.create({
            threadId: 'thread-1',
            role: 'user',
            content: 'hi' 
          }),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          status: 500,
          details: { cause: 'write failed' },
        });
        await expect(repo.findById(new ObjectId().toString())).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'read failed' },
        });
        await expect(repo.listByThread('thread-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'count failed' },
        });
      });
  });
