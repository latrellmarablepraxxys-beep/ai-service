import {
  describe, expect, it 
} from 'vitest';

import { createMemoryRepository } from '@persistence/repositories/MemoryRepository.js';
import { asDb, createFakeDb } from './fakeMongo.js';

const setup = () => {
  const fakeDb = createFakeDb();
  return {
    fakeDb,
    repo: createMemoryRepository(asDb(fakeDb)) 
  };
};

describe('memoryRepository',
  () => {
    it('creates a memory on first upsert (version 1)',
      async () => {
        const {
          fakeDb, repo 
        } = setup();

        const memory = await repo.upsert({
          threadId: 'thread-1',
          summary: 'first',
          tokenCount: 10 
        });

        expect(memory).toMatchObject({
          threadId: 'thread-1',
          summary: 'first',
          tokenCount: 10,
          version: 1,
        });
        expect(memory.id).toMatch(/^[a-f0-9]{24}$/);
        expect(memory.createdAt).toBe(memory.updatedAt);
        expect(fakeDb.collection('memories').docs).toHaveLength(1);
      });

    it('increments the version and keeps identity on re-upsert',
      async () => {
        const {
          fakeDb, repo 
        } = setup();

        const first = await repo.upsert({
          threadId: 'thread-1',
          summary: 'first',
          tokenCount: 10 
        });
        const second = await repo.upsert({
          threadId: 'thread-1',
          summary: 'second',
          tokenCount: 20 
        });

        expect(second.id).toBe(first.id);
        expect(second.createdAt).toBe(first.createdAt);
        expect(second).toMatchObject({
          summary: 'second',
          tokenCount: 20,
          version: 2 
        });
        expect(fakeDb.collection('memories').docs).toHaveLength(1);
      });

    it('finds a memory by thread id',
      async () => {
        const { repo } = setup();
        const created = await repo.upsert({
          threadId: 'thread-1',
          summary: 'first',
          tokenCount: 10 
        });

        await expect(repo.findByThread('thread-1')).resolves.toEqual(created);
        await expect(repo.findByThread('thread-2')).resolves.toBeNull();
      });

    it('maps E11000 to PERSISTENCE_DUPLICATE_KEY on upsert',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        fakeDb
          .collection('memories')
          .updateOne.mockRejectedValueOnce(
            Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
          );

        await expect(
          repo.upsert({
            threadId: 'thread-1',
            summary: 'first',
            tokenCount: 10 
          }),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_DUPLICATE_KEY',
          status: 409,
          details: { cause: 'E11000 duplicate key' },
        });
      });

    it('fails with PERSISTENCE_QUERY_ERROR when the upsert returns no document',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        fakeDb.collection('memories').findOne.mockResolvedValueOnce(null);

        await expect(
          repo.upsert({
            threadId: 'thread-1',
            summary: 'first',
            tokenCount: 10 
          }),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          status: 500 
        });
      });

    it('maps driver failures to PERSISTENCE_QUERY_ERROR',
      async () => {
        const {
          fakeDb, repo 
        } = setup();
        const memories = fakeDb.collection('memories');
        memories.updateOne.mockRejectedValueOnce(new Error('write failed'));
        memories.findOne.mockRejectedValueOnce(new Error('read failed'));

        await expect(
          repo.upsert({
            threadId: 'thread-1',
            summary: 'first',
            tokenCount: 10 
          }),
        ).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'write failed' },
        });
        await expect(repo.findByThread('thread-1')).rejects.toMatchObject({
          code: 'PERSISTENCE_QUERY_ERROR',
          details: { cause: 'read failed' },
        });
      });
  });
