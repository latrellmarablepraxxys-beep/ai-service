import { ObjectId } from 'mongodb';
import {
  describe, expect, it
} from 'vitest';

import { ConversationStage } from '@enums/ConversationStage.js';
import { createConversationStateRepository } from '@persistence/repositories/ConversationStateRepository.js';
import { asDb, createFakeDb } from './fakeMongo.js';

const setup = () => {
  const fakeDb = createFakeDb();
  return {
    fakeDb,
    repo: createConversationStateRepository(asDb(fakeDb))
  };
};

describe('conversationStateRepository',
  () => {
    it('creates a state on first upsert',
      async () => {
        const {
          fakeDb, repo
        } = setup();

        const state = await repo.upsert({
          threadId: 'thread-1',
          stage: ConversationStage.Greeted,
          data: { variant: 'sport' },
        });

        expect(state).toMatchObject({
          threadId: 'thread-1',
          stage: ConversationStage.Greeted,
          data: { variant: 'sport' },
        });
        expect(state.createdAt).toBe(state.updatedAt);
        expect(state).not.toHaveProperty('id');
        expect(fakeDb.collection('conversation_states').docs).toHaveLength(1);
      });

    it('defaults data to an empty object when omitted',
      async () => {
        const {
          fakeDb, repo
        } = setup();

        const state = await repo.upsert({
          threadId: 'thread-1',
          stage: ConversationStage.New,
        });

        expect(state.data).toEqual({});
        expect(fakeDb.collection('conversation_states').docs[0]).toMatchObject({ data: {} });
      });

    it('replaces stage and data on re-upsert while preserving createdAt',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        fakeDb.collection('conversation_states').docs.push({
          _id: new ObjectId(),
          threadId: 'thread-1',
          stage: ConversationStage.New,
          data: {},
          createdAt: '2000-01-01T00:00:00.000Z',
          updatedAt: '2000-01-01T00:00:00.000Z',
        });

        const updated = await repo.upsert({
          threadId: 'thread-1',
          stage: ConversationStage.Quoted,
          data: { price: 100 },
        });

        expect(updated).toMatchObject({
          threadId: 'thread-1',
          stage: ConversationStage.Quoted,
          data: { price: 100 },
        });
        expect(updated.createdAt).toBe('2000-01-01T00:00:00.000Z');
        expect(updated.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
        expect(fakeDb.collection('conversation_states').docs).toHaveLength(1);
      });

    it('resets data to an empty object when omitted on re-upsert',
      async () => {
        const { repo } = setup();
        await repo.upsert({
          threadId: 'thread-1',
          stage: ConversationStage.Greeted,
          data: { variant: 'sport' },
        });

        const updated = await repo.upsert({
          threadId: 'thread-1',
          stage: ConversationStage.Closed,
        });

        expect(updated.data).toEqual({});
      });

    it('finds a state by thread id',
      async () => {
        const { repo } = setup();
        const created = await repo.upsert({
          threadId: 'thread-1',
          stage: ConversationStage.New,
        });

        await expect(repo.findByThread('thread-1')).resolves.toEqual(created);
        await expect(repo.findByThread('thread-2')).resolves.toBeNull();
      });

    it('fails with PERSISTENCE_QUERY_ERROR when the upsert returns no document',
      async () => {
        const {
          fakeDb, repo
        } = setup();
        fakeDb.collection('conversation_states').findOne.mockResolvedValueOnce(null);

        await expect(
          repo.upsert({
            threadId: 'thread-1',
            stage: ConversationStage.New,
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
        const states = fakeDb.collection('conversation_states');
        states.updateOne.mockRejectedValueOnce(new Error('write failed'));
        states.findOne.mockRejectedValueOnce(new Error('read failed'));

        await expect(
          repo.upsert({
            threadId: 'thread-1',
            stage: ConversationStage.New,
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
