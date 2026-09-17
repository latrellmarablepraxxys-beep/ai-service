import {
  describe, expect, it, vi 
} from 'vitest';

import { ConversationStage } from '@enums/ConversationStage.js';
import { DecisionAction } from '@enums/DecisionAction.js';
import { EscalationStatus } from '@enums/EscalationStatus.js';
import type { MongoConnection } from '@interfaces/mongo.js';
import { createMongoPersistence } from '@persistence/MongoPersistence.js';
import { AppError } from '@utils/errors.js';
import { createFakeDb } from './repositories/fakeMongo.js';

const createFakeConnection = (overrides: Partial<MongoConnection> = {}) => {
  const fakeDb = createFakeDb();
  const connection = {
    connect: vi.fn().mockResolvedValue(undefined),
    getDb: vi.fn().mockReturnValue(fakeDb),
    close: vi.fn().mockResolvedValue(undefined),
    health: vi.fn().mockResolvedValue({
      connected: true,
      latencyMs: 3 
    }),
    ...overrides,
  };

  return {
    fakeDb,
    connection 
  };
};

describe('createMongoPersistence',
  () => {
    it('delegates connect, close and health to the connection',
      async () => {
        const { connection } = createFakeConnection();
        const persistence = createMongoPersistence({ connection });

        await persistence.connect();
        const health = await persistence.health();
        await persistence.close();

        expect(connection.connect).toHaveBeenCalledTimes(1);
        expect(connection.close).toHaveBeenCalledTimes(1);
        expect(health).toEqual({
          connected: true,
          latencyMs: 3 
        });
      });

    it('resolves repositories lazily and caches them',
      () => {
        const { connection } = createFakeConnection();
        const persistence = createMongoPersistence({ connection });

        expect(connection.getDb).not.toHaveBeenCalled();

        const threads = persistence.threads;

        expect(connection.getDb).toHaveBeenCalledTimes(1);
        expect(persistence.threads).toBe(threads);
        expect(connection.getDb).toHaveBeenCalledTimes(1);
      });

    it('wires a working repository for every port',
      async () => {
        const { connection } = createFakeConnection();
        const persistence = createMongoPersistence({ connection });

        const thread = await persistence.threads.create({
          ticketId: 't-1',
          route: 'ai' 
        });
        const message = await persistence.messages.create({
          threadId: thread.id,
          role: 'user',
          content: 'hi',
        });
        const memory = await persistence.memories.upsert({
          threadId: thread.id,
          summary: 'summary',
          tokenCount: 2,
        });
        const run = await persistence.runs.create({
          threadId: thread.id,
          type: 'routing',
          input: {} 
        });
        const state = await persistence.conversationStates.upsert({
          threadId: thread.id,
          stage: ConversationStage.Greeted,
          data: {},
        });
        const decision = await persistence.decisions.create({
          runId: run.id,
          threadId: thread.id,
          schemaVersion: 1,
          intent: 'quote',
          action: DecisionAction.Respond,
          confidence: 0.9,
          decision: {},
          validation: {
            valid: true,
            errors: [],
          },
          fallback: false,
        });
        const escalation = await persistence.escalations.create({
          threadId: thread.id,
          runId: run.id,
          topicKey: 'payments',
          reason: 'customer asked for an agent',
          summary: 'handoff requested',
          department: 'sales',
          priority: 'high',
        });

        expect(message.threadId).toBe(thread.id);
        expect(memory.threadId).toBe(thread.id);
        expect(run.threadId).toBe(thread.id);
        expect(state.threadId).toBe(thread.id);
        expect(decision.runId).toBe(run.id);
        expect(escalation.status).toBe(EscalationStatus.Pending);
        await expect(persistence.threads.findById(thread.id)).resolves.toMatchObject({ticketId: 't-1',});
      });

    it('surfaces the connection error when repositories are used before connect',
      () => {
        const { connection } = createFakeConnection({
          getDb: vi.fn(() => {
            throw new AppError('PERSISTENCE_CONNECTION_ERROR', 503, 'MongoDB is not connected');
          }),
        });
        const persistence = createMongoPersistence({ connection });

        let thrown: unknown;
        try {
          void persistence.threads;
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toMatchObject({
          code: 'PERSISTENCE_CONNECTION_ERROR',
          status: 503 
        });
      });
  });
